import { advanceReminder, parseInboundCommand } from "../../../lib/whatsapp/fsm"
import {
  invitationMessage,
  optOutConfirmation,
  reminderQuestion,
  reminderSummary,
  tableNoticeMessage,
} from "../../../lib/whatsapp/templates"
import {
  SendPipelineError,
  classifySendFailure,
  isDefinitelyPreSendProviderError,
  operationalErrorMessage,
} from "../../../lib/whatsapp/send-outcome"
import type {
  DeliveryContext,
  MessagingProvider,
  ProviderInboundMessage,
  WhatsAppOutboundContext,
} from "../../../lib/whatsapp/types"
import { WorkerRepository, type InboundWork } from "./repository"

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export class WhatsAppWorkerEngine {
  private stopping = false
  private consecutiveFailures = 0
  private lastAutomationRun = 0
  private hasLease = false
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatRunning = false

  constructor(
    private readonly workerId: string,
    private readonly repository: WorkerRepository,
    private readonly provider: MessagingProvider,
    private readonly config: {
      publicAppUrl: string
      minDelayMs: number
      maxDelayMs: number
      hourlyLimit: number
      globalEnabled: boolean
      allowlist: Set<string> | null
    },
  ) {
    provider.onInbound((message) => this.handleInbound(message))
    provider.onStatus((status) => this.repository.updateProviderStatus(status))
  }

  async run() {
    if (!this.config.globalEnabled) {
      while (!this.stopping) await wait(60_000)
      return
    }
    while (!this.stopping) {
      try {
        if (!(await this.repository.acquireLease(this.workerId))) {
          this.hasLease = false
          await wait(5_000)
          continue
        }
        this.hasLease = true
        this.startHeartbeat()
        if (!this.provider.isConnected()) await this.provider.connect()
        if (Date.now() - this.lastAutomationRun >= 60_000) {
          await this.repository.enqueueDueAutomations()
          this.lastAutomationRun = Date.now()
        }
        if (!this.hasLease || !this.provider.isConnected()) {
          await wait(2_000)
          continue
        }

        const inboundWork = await this.repository.claimInbound(this.workerId)
        if (inboundWork) {
          await this.processInboundSafely(inboundWork)
          continue
        }

        if ((await this.repository.sentLastHour()) >= this.config.hourlyLimit) {
          await wait(30_000)
          continue
        }

        const outboundJob = await this.repository.claimOutbound(this.workerId)
        if (outboundJob) {
          try {
            const context = await this.repository.getOutboundContext(outboundJob.id)
            await this.processOutbound(context)
            this.consecutiveFailures = 0
            await wait(this.randomDelay())
          } catch (error) {
            this.consecutiveFailures += 1
            const outcome = classifySendFailure(error)
            await this.persistCriticalMutation(
              () => this.repository.markOutboundFailed(outboundJob, error, outcome),
              "outbound_failure",
            )
            if (this.consecutiveFailures >= 5) {
              // No more work is claimed during the cool-down. This is shared
              // with campaign delivery failures and keeps provider pressure low.
              await wait(60_000)
              this.consecutiveFailures = 0
            }
          }
          continue
        }

        const delivery = await this.repository.claim(this.workerId)
        if (!delivery) {
          await wait(2_000)
          continue
        }
        try {
          const context = await this.repository.getDeliveryContext(delivery.id)
          await this.processDelivery(context)
          this.consecutiveFailures = 0
          await wait(this.randomDelay())
        } catch (error) {
          this.consecutiveFailures += 1
          const outcome = classifySendFailure(error)
          await this.persistCriticalMutation(
            () => this.repository.markFailed(delivery, error, outcome),
            "delivery_failure",
          )
          if (this.consecutiveFailures >= 5) {
            await this.repository.pauseCampaign(delivery.campaignId, "consecutive_provider_errors")
            this.consecutiveFailures = 0
          }
        }
      } catch (error) {
        // Logs intentionally contain no phone numbers or message bodies.
        console.error("whatsapp_worker_loop_error", safeError(error))
        await wait(5_000)
      }
    }
  }

  private async processDelivery(context: DeliveryContext) {
    // Suppression/stale-recovery may have finalized the row after it was
    // claimed but before its context finished loading.
    if (context.status !== "sending") return
    const eventAt = Date.parse(context.event.eventAt ?? "")
    if (
      Number.isFinite(eventAt)
      && (
        (context.kind === "reminder" && Date.now() > eventAt - 24 * 60 * 60 * 1000)
        || (context.kind !== "reminder" && Date.now() >= eventAt)
      )
    ) {
      await this.repository.markCancelled(context, "EXPIRED_EVENT_WINDOW")
      return
    }
    if (!this.hasLease) throw new Error("PROVIDER_DISCONNECTED")
    if (!context.event.messagingEnabled || !context.group.consentAt) {
      await this.repository.markCancelled(context, "NOT_ELIGIBLE")
      return
    }
    if (this.config.allowlist && !this.config.allowlist.has(context.group.phoneE164)) {
      await this.repository.markCancelled(context, "NOT_ALLOWLISTED")
      return
    }

    const invitationUrl = `${this.config.publicAppUrl}/invitaciones/${encodeURIComponent(context.event.slug)}?token=${encodeURIComponent(context.group.invitationToken)}`
    let text: string
    let payload: Record<string, unknown> = {}
    let conversationId: string | null = null

    if (context.kind === "invitation") {
      text = invitationMessage({
        coupleName: context.event.displayName,
        groupName: context.group.displayName,
        invitationUrl,
        customMessage: context.customMessage,
      })
    } else if (context.kind === "reminder") {
      const pending = context.guests.find((guest) => guest.attendanceStatus === "pending")
      if (!pending) {
        await this.repository.markCancelled(context, "NO_PENDING_GUESTS")
        return
      }
      conversationId = await this.repository.createReminderConversation(context, pending.id)
      text = reminderQuestion({
        groupName: context.group.displayName,
        guestName: pending.name,
        coupleName: context.event.displayName,
        customMessage: context.customMessage,
      })
      payload = { currentGuestId: pending.id }
    } else {
      const attending = context.guests
        .filter((guest) => guest.attendanceStatus === "attending" && guest.tableLabel)
        .map((guest) => ({ name: guest.name, tableLabel: guest.tableLabel! }))
      const omittedGuestIds = context.guests
        .filter((guest) => guest.attendanceStatus === "attending" && !guest.tableLabel)
        .map((guest) => guest.id)
      await this.repository.recordMissingTableAlerts(context, omittedGuestIds)
      if (attending.length === 0) {
        await this.repository.markCancelled(context, "NO_ATTENDING_GUESTS_WITH_TABLE")
        return
      }
      text = tableNoticeMessage({
        groupName: context.group.displayName,
        coupleName: context.event.displayName,
        customMessage: context.customMessage ?? context.event.tableNoticeMessage,
        guests: attending,
      })
      payload = {
        tableSnapshot: attending,
        omittedGuestIds,
      }
    }

    if (await this.repository.isSuppressed(context.group.phoneE164)) {
      await this.repository.markCancelled(context, "PHONE_SUPPRESSED")
      return
    }
    let sent
    try {
      sent = await this.provider.sendText(context.group.phoneE164, text)
    } catch (error) {
      throw new SendPipelineError(error, !isDefinitelyPreSendProviderError(error))
    }
    try {
      if (conversationId) await this.repository.setConversationOutbound(conversationId, sent.id)
      await this.repository.markSent(context, sent.id, payload)
    } catch (error) {
      throw new SendPipelineError(error, true)
    }
  }

  private async processOutbound(context: WhatsAppOutboundContext) {
    if (context.status !== "sending") return
    if (!this.hasLease || !this.provider.isConnected()) {
      throw new Error("PROVIDER_DISCONNECTED")
    }
    if (this.config.allowlist && !this.config.allowlist.has(context.recipientPhoneE164)) {
      await this.repository.markOutboundCancelled(context, "NOT_ALLOWLISTED")
      return
    }

    const isOptOutConfirmation = context.action === "opt_out_confirmation"
    if (!isOptOutConfirmation) {
      if (!context.event || !context.group || !context.conversationId) {
        await this.repository.markOutboundCancelled(context, "OUTBOUND_CONTEXT_MISSING")
        return
      }
      const eventAt = Date.parse(context.event.eventAt ?? "")
      if (Number.isFinite(eventAt) && Date.now() >= eventAt) {
        await this.repository.markOutboundCancelled(context, "EXPIRED_EVENT_WINDOW")
        return
      }
      if (!context.event.messagingEnabled || !context.group.consentAt) {
        await this.repository.markOutboundCancelled(context, "NOT_ELIGIBLE")
        return
      }
      if (await this.repository.isSuppressed(context.recipientPhoneE164)) {
        await this.repository.markOutboundCancelled(context, "PHONE_SUPPRESSED")
        return
      }
    }

    let text: string
    if (context.action === "opt_out_confirmation") {
      text = optOutConfirmation
    } else if (context.action === "ask_attendance") {
      const guest = context.guests.find((entry) => entry.id === context.guestId)
      if (!guest || !context.event || !context.group) {
        await this.repository.markOutboundCancelled(context, "OUTBOUND_GUEST_MISSING")
        return
      }
      text = reminderQuestion({
        groupName: context.group.displayName,
        guestName: guest.name,
        coupleName: context.event.displayName,
      })
    } else if (context.action === "ask_change_selection") {
      text = [
        "¿Qué respuesta querés cambiar? Respondé con el número:",
        ...context.guests.map((guest, index) => `${index + 1}. ${guest.name}`),
      ].join("\n")
    } else if (context.action === "send_summary") {
      if (!context.event || !context.group) {
        await this.repository.markOutboundCancelled(context, "OUTBOUND_CONTEXT_MISSING")
        return
      }
      text = reminderSummary({
        coupleName: context.event.displayName,
        guests: context.guests,
        invitationUrl: `${this.config.publicAppUrl}/invitaciones/${encodeURIComponent(context.event.slug)}?token=${encodeURIComponent(context.group.invitationToken)}`,
      })
    } else if (context.action === "review_notice") {
      text = "No pudimos interpretar la respuesta. Los novios la revisarán personalmente."
    } else {
      text = "No entendimos la respuesta. Contestá 1/SÍ, 2/NO, CAMBIAR o BAJA."
    }

    let sent
    try {
      sent = await this.provider.sendText(context.recipientPhoneE164, text)
    } catch (error) {
      throw new SendPipelineError(error, !isDefinitelyPreSendProviderError(error))
    }
    try {
      await this.repository.markOutboundSent(context, sent.id)
    } catch (error) {
      throw new SendPipelineError(error, true)
    }
  }

  private async handleInbound(message: ProviderInboundMessage) {
    const command = parseInboundCommand(message.text)
    try {
      const work = await this.repository.registerInbound(message, command, this.workerId)
      if (work) await this.processInboundSafely(work)
    } catch (error) {
      // If registration itself cannot reach the database there is no partial
      // mutation to compensate. Baileys/provider redelivery remains safe.
      console.error("whatsapp_inbound_registration_error", safeError(error))
    }
  }

  private async processInboundSafely(work: InboundWork) {
    let conversationId: string | undefined
    try {
      if (work.command.type === "stop") {
        // Suppression, cancellation, inbound resolution and the confirmation
        // outbox row commit together. The dispatcher sends it under the normal
        // allowlist, cap and delay.
        await this.repository.suppressPhone(work.message.from, work.id)
        return
      }

      const conversation = await this.repository.resolveConversation(
        work.message,
        work.command.type === "change",
      )
      if (!conversation) {
        await this.repository.resolveInbound(work.id, "ambiguous")
        return
      }
      conversationId = conversation.id

      const transition = advanceReminder(
        conversation.state,
        conversation.guests,
        work.command,
      )
      const attendanceAction = transition.actions.find(
        (action) => action.type === "update_attendance",
      )
      const outboundAction = transition.actions.find((action) =>
        ["ask_attendance", "ask_change_selection", "send_summary", "mark_review"].includes(action.type),
      )
      const outbound = outboundAction?.type === "ask_attendance"
        ? { action: "ask_attendance" as const, guestId: outboundAction.guestId }
        : outboundAction?.type === "ask_change_selection"
          ? { action: "ask_change_selection" as const, guestId: null }
          : outboundAction?.type === "send_summary"
            ? { action: "send_summary" as const, guestId: null }
            : outboundAction?.type === "mark_review"
              ? { action: "review_notice" as const, guestId: null }
              : { action: "invalid_prompt" as const, guestId: null }
      try {
        if (attendanceAction?.type === "update_attendance") {
          // Attendance, conversation advancement, inbound resolution and the
          // next semantic message commit together.
          await this.repository.applyAttendanceAndAdvance(
            conversation.id,
            attendanceAction.guestId,
            attendanceAction.status,
            transition.state,
            work.id,
            outbound.action,
            outbound.guestId,
          )
        } else {
          await this.repository.updateConversation(
            conversation.id,
            transition.state,
            conversation.state,
            work.id,
            outbound.action,
            outbound.guestId,
          )
        }
      } catch (error) {
        if (isConversationRace(error)) {
          await this.repository.resolveInbound(work.id, "ambiguous", conversation.id)
          return
        }
        if (safeError(error).toLowerCase().includes("phone_suppressed")) {
          await this.repository.resolveInbound(work.id, "ignored", conversation.id)
          return
        }
        throw error
      }
    } catch (error) {
      // Persisted encrypted ownership + semantic command allow a later loop to
      // retry without storing the original message body. Five failed attempts
      // atomically flag the conversation for review.
      console.error("whatsapp_inbound_processing_error", safeError(error))
      try {
        await this.repository.retryInbound(work, this.workerId, error, conversationId)
      } catch (retryError) {
        // The lock becomes reclaimable after two minutes if this write also
        // fails, so an outage cannot terminalize and lose the response.
        console.error("whatsapp_inbound_retry_error", safeError(retryError))
      }
    }
  }

  private randomDelay() {
    return Math.round(
      this.config.minDelayMs + Math.random() * (this.config.maxDelayMs - this.config.minDelayMs),
    )
  }

  /**
   * Once a row has been claimed, losing both the provider result and the DB
   * finalization is the one condition that can create a duplicate on a later
   * retry. Keep the dispatcher fail-closed until that exact row is durably
   * finalized. The repository updates are compare-and-set and safe to replay
   * when the first response was lost after commit.
   */
  private async persistCriticalMutation(
    operation: () => Promise<void>,
    scope: string,
  ) {
    let attempt = 0
    while (!this.stopping) {
      try {
        await operation()
        return
      } catch (error) {
        attempt += 1
        this.hasLease = false
        try {
          await this.provider.disconnect()
        } catch (disconnectError) {
          console.error(
            `whatsapp_${scope}_disconnect_error`,
            safeError(disconnectError),
          )
        }
        console.error(`whatsapp_${scope}_persistence_error`, safeError(error))
        await wait(Math.min(60_000, 1_000 * 2 ** Math.min(attempt, 6)))
      }
    }
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) return
    this.heartbeatTimer = setInterval(() => void this.heartbeat(), 15_000)
  }

  private async heartbeat() {
    if (this.heartbeatRunning || this.stopping) return
    this.heartbeatRunning = true
    try {
      this.hasLease = await this.repository.acquireLease(this.workerId)
      if (!this.hasLease) await this.provider.disconnect()
    } catch (error) {
      this.hasLease = false
      await this.provider.disconnect()
      console.error("whatsapp_worker_heartbeat_error", safeError(error))
    } finally {
      this.heartbeatRunning = false
    }
  }

  async stop() {
    this.stopping = true
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
    await this.provider.disconnect()
    await this.repository.releaseLease(this.workerId)
  }
}

function isConversationRace(error: unknown) {
  const message = safeError(error).toLowerCase()
  return message.includes("state_changed")
    || message.includes("conversation_not_active")
    || message.includes("inbound_event_already_processed")
}

function safeError(error: unknown) {
  return operationalErrorMessage(error)
}
