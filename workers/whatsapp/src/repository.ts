import { createHmac } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createInvitationToken } from "../../../lib/crm/tokens"
import { decryptSecret, encryptSecret } from "../../../lib/whatsapp/crypto"
import type {
  DeliveryContext,
  MessageDelivery,
  ProviderInboundMessage,
  ProviderMessageStatus,
  WhatsAppOutboundContext,
  WhatsAppOutboundJob,
} from "../../../lib/whatsapp/types"
import type { InboundCommand, ReminderState } from "../../../lib/whatsapp/fsm"
import type { WhatsAppOutboundAction } from "../../../lib/whatsapp/types"

type ConversationView = {
  id: string
  eventId: string
  groupId: string
  state: ReminderState
  event: { slug: string; displayName: string }
  group: { displayName: string; phoneE164: string; invitationToken: string }
  guests: Array<{
    id: string
    name: string
    attendanceStatus: "pending" | "attending" | "declined"
  }>
}

type InboundWork = {
  id: string
  attemptCount: number
  command: InboundCommand
  message: ProviderInboundMessage
}

export class WorkerRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly encryptionKey: string,
    private readonly hashingSecret: string,
  ) {}

  async acquireLease(workerId: string) {
    const { data, error } = await this.client.rpc("acquire_whatsapp_worker_lease", {
      p_worker_id: workerId,
      p_ttl_seconds: 45,
    })
    if (error) throw new Error(`lease:${error.message}`)
    return data === true
  }

  async releaseLease(workerId: string) {
    const { error } = await this.client.rpc("release_whatsapp_worker_lease", {
      p_worker_id: workerId,
    })
    if (error) throw new Error(`lease_release:${error.message}`)
  }

  async enqueueDueAutomations(now = new Date()) {
    const { error } = await this.client.rpc("enqueue_due_message_automations", {
      p_now: now.toISOString(),
    })
    if (error) throw new Error(`scheduler:${error.message}`)
  }

  async sentLastHour() {
    const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const [accepted, uncertain, outboundAccepted, outboundUncertain] = await Promise.all([
      this.client
        .from("message_deliveries")
        .select("id", { count: "exact", head: true })
        .in("status", ["sent", "delivered", "read"])
        .gte("sent_at", threshold),
      // A provider timeout may still have delivered the message. Count it
      // conservatively so ambiguous outcomes cannot bypass the hourly cap.
      this.client
        .from("message_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("status", "uncertain")
        .gte("failed_at", threshold),
      this.client
        .from("whatsapp_outbound_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["sent", "delivered", "read"])
        .gte("sent_at", threshold),
      this.client
        .from("whatsapp_outbound_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "uncertain")
        .gte("failed_at", threshold),
    ])
    if (accepted.error) throw new Error(`sent_count:${accepted.error.message}`)
    if (uncertain.error) throw new Error(`sent_count:${uncertain.error.message}`)
    if (outboundAccepted.error) throw new Error(`outbound_sent_count:${outboundAccepted.error.message}`)
    if (outboundUncertain.error) throw new Error(`outbound_sent_count:${outboundUncertain.error.message}`)
    return (accepted.count ?? 0)
      + (uncertain.count ?? 0)
      + (outboundAccepted.count ?? 0)
      + (outboundUncertain.count ?? 0)
  }

  async claim(workerId: string): Promise<MessageDelivery | null> {
    const { data, error } = await this.client.rpc("claim_message_deliveries", {
      p_worker_id: workerId,
      p_limit: 1,
    })
    if (error) throw new Error(`claim:${error.message}`)
    const row = data?.[0]
    if (!row) return null
    return {
      id: row.id,
      campaignId: row.campaign_id,
      eventId: row.event_id,
      groupId: row.group_id,
      kind: "invitation",
      status: row.status,
      attemptCount: row.attempt_count,
      nextAttemptAt: row.next_attempt_at,
      customMessage: null,
      payload: row.payload ?? {},
    }
  }

  async claimOutbound(workerId: string): Promise<WhatsAppOutboundJob | null> {
    const { data, error } = await this.client.rpc("claim_whatsapp_outbound_jobs", {
      p_worker_id: workerId,
      p_limit: 1,
    })
    if (error) throw new Error(`outbound_claim:${error.message}`)
    const row = data?.[0]
    if (!row) return null
    return {
      id: row.id,
      eventId: row.event_id,
      groupId: row.group_id,
      conversationId: row.conversation_id,
      action: row.action,
      guestId: row.guest_id,
      recipientPhoneE164: row.recipient_phone_e164,
      status: row.status,
      attemptCount: row.attempt_count,
      nextAttemptAt: row.next_attempt_at,
    }
  }

  async getOutboundContext(jobId: string): Promise<WhatsAppOutboundContext> {
    const { data, error } = await this.client
      .from("whatsapp_outbound_jobs")
      .select(`
        id,event_id,group_id,conversation_id,action,guest_id,recipient_phone_e164,
        status,attempt_count,next_attempt_at,
        events(slug,display_name,event_at,messaging_enabled),
        invitation_groups(
          id,display_name,consent_at,invitation_token_hash,invitation_token_last4,
          invitation_token_ciphertext,guests(id,name,attendance_status,created_at)
        )
      `)
      .eq("id", jobId)
      .single()
    if (error || !data) throw new Error(`outbound_context:${error?.message ?? "not_found"}`)

    const row = data as any
    const group = row.invitation_groups
    const event = row.events
    const token = group && row.action === "send_summary"
      ? await this.ensureInvitationToken(group)
      : ""
    return {
      id: row.id,
      eventId: row.event_id,
      groupId: row.group_id,
      conversationId: row.conversation_id,
      action: row.action,
      guestId: row.guest_id,
      recipientPhoneE164: row.recipient_phone_e164,
      status: row.status,
      attemptCount: row.attempt_count,
      nextAttemptAt: row.next_attempt_at,
      event: event
        ? {
            slug: event.slug,
            displayName: event.display_name,
            eventAt: event.event_at,
            messagingEnabled: event.messaging_enabled,
          }
        : null,
      group: group
        ? {
            displayName: group.display_name,
            consentAt: group.consent_at,
            invitationToken: token,
          }
        : null,
      guests: [...(group?.guests ?? [])]
        .sort((left: any, right: any) =>
          String(left.created_at).localeCompare(String(right.created_at))
            || String(left.id).localeCompare(String(right.id)),
        )
        .map((guest: any) => ({
          id: guest.id,
          name: guest.name,
          attendanceStatus: guest.attendance_status,
        })),
    }
  }

  async getDeliveryContext(deliveryId: string): Promise<DeliveryContext> {
    const { data, error } = await this.client
      .from("message_deliveries")
      .select(`
        id,campaign_id,event_id,group_id,status,attempt_count,next_attempt_at,payload,
        message_campaigns!inner(kind,custom_message),
        events!inner(slug,display_name,event_at,timezone,messaging_enabled,table_notice_message),
        invitation_groups!inner(
          id,display_name,phone_e164,consent_at,invitation_token_hash,
          invitation_token_last4,invitation_token_ciphertext,
          guests(id,name,attendance_status,table_id,created_at,seating_tables(label,code))
        )
      `)
      .eq("id", deliveryId)
      .single()
    if (error || !data) throw new Error(`delivery_context:${error?.message ?? "not_found"}`)

    const row = data as any
    const group = row.invitation_groups
    const token = await this.ensureInvitationToken(group)
    return {
      id: row.id,
      campaignId: row.campaign_id,
      eventId: row.event_id,
      groupId: row.group_id,
      kind: row.message_campaigns.kind,
      status: row.status,
      attemptCount: row.attempt_count,
      nextAttemptAt: row.next_attempt_at,
      customMessage: row.message_campaigns.custom_message,
      payload: row.payload ?? {},
      event: {
        slug: row.events.slug,
        displayName: row.events.display_name,
        eventAt: row.events.event_at,
        timezone: row.events.timezone,
        messagingEnabled: row.events.messaging_enabled,
        tableNoticeMessage: row.events.table_notice_message,
      },
      group: {
        displayName: group.display_name,
        phoneE164: group.phone_e164,
        consentAt: group.consent_at,
        invitationToken: token,
      },
      guests: [...(group.guests ?? [])]
        .sort((left: any, right: any) =>
          String(left.created_at).localeCompare(String(right.created_at)) || String(left.id).localeCompare(String(right.id)),
        )
        .map((guest: any) => ({
        id: guest.id,
        name: guest.name,
        attendanceStatus: guest.attendance_status,
        tableLabel: guest.seating_tables?.label ?? guest.seating_tables?.code ?? null,
      })),
    }
  }

  private async ensureInvitationToken(group: any) {
    if (group.invitation_token_ciphertext) {
      return decryptSecret(group.invitation_token_ciphertext, this.encryptionKey)
    }
    const token = createInvitationToken()
    const { error } = await this.client
      .from("invitation_groups")
      .update({
        invitation_token_hash: token.hash,
        invitation_token_last4: token.last4,
        invitation_token_ciphertext: encryptSecret(token.token, this.encryptionKey),
        updated_at: new Date().toISOString(),
      })
      .eq("id", group.id)
    if (error) throw new Error(`token_generation:${error.message}`)
    return token.token
  }

  async markOutboundSent(job: WhatsAppOutboundContext, providerMessageId: string) {
    const { data, error } = await this.client.rpc("mark_whatsapp_outbound_sent", {
      p_job_id: job.id,
      p_provider_message_id: providerMessageId,
    })
    if (error) throw new Error(`outbound_mark_sent:${error.message}`)
    if (!data) throw new Error("OUTBOUND_FINALIZED_AFTER_SEND")
  }

  async markOutboundCancelled(job: WhatsAppOutboundJob, code: string) {
    const now = new Date().toISOString()
    const { error } = await this.client
      .from("whatsapp_outbound_jobs")
      .update({
        status: "cancelled",
        error_code: code,
        locked_at: null,
        locked_by: null,
        updated_at: now,
      })
      .eq("id", job.id)
      .eq("status", "sending")
    if (error) throw new Error(`outbound_cancel:${error.message}`)
  }

  async markOutboundFailed(
    job: WhatsAppOutboundJob,
    _error: unknown,
    outcome: { providerAttempted: boolean; retryable: boolean },
  ) {
    const retry = !outcome.providerAttempted && outcome.retryable && job.attemptCount < 5
    const status = outcome.providerAttempted ? "uncertain" : retry ? "failed" : "cancelled"
    const backoffMinutes = Math.min(60, 2 ** Math.max(0, job.attemptCount - 1))
    const now = new Date().toISOString()
    const { error: updateError } = await this.client
      .from("whatsapp_outbound_jobs")
      .update({
        status,
        error_code: outcome.providerAttempted
          ? "DELIVERY_AMBIGUOUS"
          : retry
            ? "PRE_SEND_TRANSIENT"
            : "PRE_SEND_TERMINAL",
        failed_at: now,
        next_attempt_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
        locked_at: null,
        locked_by: null,
        updated_at: now,
      })
      .eq("id", job.id)
      .eq("status", "sending")
    if (updateError) throw new Error(`outbound_mark_failed:${updateError.message}`)
  }

  async markSent(
    delivery: DeliveryContext,
    providerMessageId: string,
    payload: Record<string, unknown> = {},
  ) {
    const now = new Date().toISOString()
    const { data, error } = await this.client.rpc("mark_message_delivery_sent", {
      p_delivery_id: delivery.id,
      p_provider_message_id: providerMessageId,
      p_payload: payload,
    })
    if (error) throw new Error(`mark_sent:${error.message}`)
    if (!data) throw new Error("DELIVERY_FINALIZED_AFTER_SEND")
    if (delivery.kind === "table_correction") {
      const cutoff = delivery.payload.correctsStaleThrough
      if (typeof cutoff === "string") {
        const clearResult = await this.client
        .from("message_deliveries")
        .update({ is_stale: false, stale_at: null, updated_at: now })
        .eq("group_id", delivery.groupId)
        .eq("is_stale", true)
          .lte("stale_at", cutoff)
        if (clearResult.error) throw new Error(`clear_stale:${clearResult.error.message}`)
      }
    }
    await this.refreshCampaignStatus(delivery.campaignId)
  }

  async markCancelled(delivery: MessageDelivery, code: string) {
    const { error } = await this.client
      .from("message_deliveries")
      .update({
        status: "cancelled",
        error_code: code,
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id)
      .eq("status", "sending")
      .select("id")
      .maybeSingle()
    if (error) throw new Error(`cancel:${error.message}`)
    await this.refreshCampaignStatus(delivery.campaignId)
  }

  async markFailed(
    delivery: MessageDelivery,
    error: unknown,
    outcome: { providerAttempted: boolean; retryable: boolean },
  ) {
    const retry = !outcome.providerAttempted && outcome.retryable && delivery.attemptCount < 5
    const status = outcome.providerAttempted ? "uncertain" : retry ? "failed" : "cancelled"
    const message = outcome.providerAttempted
      ? "The provider outcome is unknown; automatic retry is disabled."
      : sanitizeOperationalDetail(error)
    const backoffMinutes = Math.min(60, 2 ** Math.max(0, delivery.attemptCount - 1))
    const nextAttempt = new Date(Date.now() + backoffMinutes * 60_000).toISOString()
    const { error: dbError } = await this.client
      .from("message_deliveries")
      .update({
        status,
        error_code: outcome.providerAttempted
          ? "DELIVERY_AMBIGUOUS"
          : retry
            ? "PRE_SEND_TRANSIENT"
            : "PRE_SEND_TERMINAL",
        error_detail: message.slice(0, 500),
        failed_at: new Date().toISOString(),
        next_attempt_at: nextAttempt,
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id)
      .eq("status", "sending")
      .select("id")
      .maybeSingle()
    if (dbError) throw new Error(`mark_failed:${dbError.message}`)
    await this.refreshCampaignStatus(delivery.campaignId)
  }

  async pauseCampaign(campaignId: string, reason: string) {
    const { data: campaign, error: readError } = await this.client
      .from("message_campaigns")
      .select("metadata")
      .eq("id", campaignId)
      .single()
    if (readError) throw new Error(`campaign_pause_read:${readError.message}`)
    const { error } = await this.client
      .from("message_campaigns")
      .update({
        status: "paused",
        metadata: { ...((campaign.metadata as Record<string, unknown> | null) ?? {}), pauseReason: reason },
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .in("status", ["queued", "running"])
    if (error) throw new Error(`campaign_pause:${error.message}`)
  }

  async updateProviderStatus(status: ProviderMessageStatus) {
    const { error } = await this.client.rpc("record_whatsapp_provider_status", {
      p_provider_message_id: status.id,
      p_status: status.status,
      p_occurred_at: status.occurredAt.toISOString(),
    })
    if (error) throw new Error(`provider_status:${error.message}`)

    const delivery = await this.client
      .from("message_deliveries")
      .select("campaign_id")
      .eq("provider_message_id", status.id)
      .maybeSingle()
    if (delivery.error) throw new Error(`provider_status_campaign:${delivery.error.message}`)
    if (delivery.data?.campaign_id) {
      await this.refreshCampaignStatus(delivery.data.campaign_id as string)
    }
  }

  async createReminderConversation(context: DeliveryContext, currentGuestId: string) {
    const existing = await this.client
      .from("whatsapp_conversations")
      .select("id")
      .eq("group_id", context.groupId)
      .in("state", ["awaiting_attendance", "awaiting_change_selection"])
      .maybeSingle()
    if (existing.error) throw new Error(`conversation_read:${existing.error.message}`)
    if (existing.data) return existing.data.id as string
    const { data, error } = await this.client
      .from("whatsapp_conversations")
      .insert({
        event_id: context.eventId,
        group_id: context.groupId,
        delivery_id: context.id,
        state: "awaiting_attendance",
        current_guest_id: currentGuestId,
      })
      .select("id")
      .single()
    if (error) throw new Error(`conversation_create:${error.message}`)
    return data.id as string
  }

  async setConversationOutbound(conversationId: string, providerMessageId: string) {
    const { error } = await this.client
      .from("whatsapp_conversations")
      .update({ last_outbound_message_id: providerMessageId, updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .in("state", ["awaiting_attendance", "awaiting_change_selection", "completed"])
    if (error) throw new Error(`conversation_outbound:${error.message}`)
  }

  async registerInbound(
    message: ProviderInboundMessage,
    command: InboundCommand,
    workerId: string,
  ): Promise<InboundWork | null> {
    const { data, error } = await this.client
      .from("whatsapp_inbound_events")
      .insert({
        provider_message_id: message.id,
        phone_hash: this.hashPhone(message.from),
        phone_ciphertext: encryptSecret(message.from, this.encryptionKey),
        quoted_message_id: message.quotedMessageId,
        command: command.type,
        command_payload: command.type === "select" ? { index: command.index } : {},
        received_at: message.receivedAt.toISOString(),
        locked_at: new Date().toISOString(),
        locked_by: workerId,
      })
      .select("id,attempt_count")
      .maybeSingle()
    if (error?.code === "23505") {
      // A previous attempt may have failed after durably registering the
      // provider id. Only unresolved events are eligible for a safe replay;
      // completed events stay exactly-once.
      const existing = await this.client
        .from("whatsapp_inbound_events")
        .select("id,resolution,attempt_count,locked_at,locked_by")
        .eq("provider_message_id", message.id)
        .maybeSingle()
      if (existing.error) throw new Error(`inbound_recover:${existing.error.message}`)
      if (!existing.data || existing.data.resolution !== "pending") return null
      const lockTime = Date.parse(existing.data.locked_at ?? "")
      if (
        existing.data.locked_by
        && Number.isFinite(lockTime)
        && lockTime >= Date.now() - 2 * 60_000
      ) return null
      const reclaimed = await this.client
        .from("whatsapp_inbound_events")
        .update({ locked_at: new Date().toISOString(), locked_by: workerId })
        .eq("id", existing.data.id)
        .eq("resolution", "pending")
        .is("locked_at", null)
        .select("id,attempt_count")
        .maybeSingle()
      if (reclaimed.error) throw new Error(`inbound_recover:${reclaimed.error.message}`)
      return reclaimed.data
        ? {
            id: reclaimed.data.id as string,
            attemptCount: reclaimed.data.attempt_count as number,
            command,
            message,
          }
        : null
    }
    if (error) throw new Error(`inbound_register:${error.message}`)
    return data
      ? {
          id: data.id as string,
          attemptCount: data.attempt_count as number,
          command,
          message,
        }
      : null
  }

  async claimInbound(workerId: string): Promise<InboundWork | null> {
    const { data, error } = await this.client.rpc("claim_whatsapp_inbound_events", {
      p_worker_id: workerId,
      p_limit: 1,
    })
    if (error) throw new Error(`inbound_claim:${error.message}`)
    const row = data?.[0]
    if (!row) return null
    const phone = decryptSecret(row.phone_ciphertext, this.encryptionKey)
    return {
      id: row.id,
      attemptCount: row.attempt_count,
      command: deserializeInboundCommand(row.command, row.command_payload),
      message: {
        id: row.provider_message_id,
        from: phone,
        text: "",
        quotedMessageId: row.quoted_message_id,
        receivedAt: new Date(row.received_at),
      },
    }
  }

  async retryInbound(
    work: InboundWork,
    workerId: string,
    error: unknown,
    conversationId?: string,
  ) {
    const backoffSeconds = Math.min(300, 2 ** Math.max(0, work.attemptCount - 1) * 5)
    const { error: retryError } = await this.client.rpc("retry_whatsapp_inbound_event", {
      p_inbound_event_id: work.id,
      p_worker_id: workerId,
      p_error_code: inboundErrorCode(error),
      p_next_attempt_at: new Date(Date.now() + backoffSeconds * 1_000).toISOString(),
      p_conversation_id: conversationId ?? null,
    })
    if (retryError) throw new Error(`inbound_retry:${retryError.message}`)
  }

  async resolveConversation(
    message: ProviderInboundMessage,
    allowQuotedCompleted = false,
  ): Promise<ConversationView | null> {
    const selectConversation = (states: string[]) =>
      this.client
        .from("whatsapp_conversations")
        .select(`
          id,event_id,group_id,state,current_guest_id,invalid_attempts,
          events!inner(slug,display_name),
          invitation_groups!inner(
            id,display_name,phone_e164,invitation_token_ciphertext,invitation_token_hash,
            invitation_token_last4,guests(id,name,attendance_status,created_at)
          )
        `)
        .in("state", states)
        .eq("invitation_groups.phone_e164", message.from)
        .not("last_outbound_message_id", "is", null)

    let rows: any[] = []
    if (message.quotedMessageId) {
      const quoted = await selectConversation([
        "awaiting_attendance",
        "awaiting_change_selection",
        ...(allowQuotedCompleted ? ["completed", "review"] : []),
      ])
        .eq("last_outbound_message_id", message.quotedMessageId)
        .limit(2)
      if (quoted.error) throw new Error(`conversation_resolve:${quoted.error.message}`)
      rows = quoted.data ?? []
      // A quoted provider id is the strongest correlation signal. If corrupt
      // or historical data maps it to more than one conversation, falling
      // back to the phone could update the wrong wedding.
      if (rows.length > 1) return null
    }
    if (rows.length === 0) {
      const fallback = await selectConversation([
        "awaiting_attendance",
        "awaiting_change_selection",
      ]).limit(2)
      if (fallback.error) throw new Error(`conversation_resolve:${fallback.error.message}`)
      rows = fallback.data ?? []
    }
    if (rows.length !== 1) return null
    const row = rows[0] as any
    const token = await this.ensureInvitationToken(row.invitation_groups)
    return {
      id: row.id,
      eventId: row.event_id,
      groupId: row.group_id,
      state: {
        mode: row.state,
        currentGuestId: row.current_guest_id,
        invalidAttempts: row.invalid_attempts,
      },
      event: { slug: row.events.slug, displayName: row.events.display_name },
      group: {
        displayName: row.invitation_groups.display_name,
        phoneE164: row.invitation_groups.phone_e164,
        invitationToken: token,
      },
      guests: [...(row.invitation_groups.guests ?? [])]
        .sort((left: any, right: any) =>
          String(left.created_at).localeCompare(String(right.created_at)) || String(left.id).localeCompare(String(right.id)),
        )
        .map((guest: any) => ({
        id: guest.id,
        name: guest.name,
        attendanceStatus: guest.attendance_status,
      })),
    }
  }

  async updateConversation(
    conversationId: string,
    state: ReminderState,
    expected: ReminderState,
    inboundId: string,
    outboundAction: WhatsAppOutboundAction,
    outboundGuestId: string | null,
  ) {
    const { data, error } = await this.client.rpc("advance_whatsapp_conversation", {
      p_conversation_id: conversationId,
      p_expected_state: expected.mode,
      p_expected_guest_id: expected.currentGuestId,
      p_expected_invalid_attempts: expected.invalidAttempts,
      p_next_state: state.mode,
      p_next_guest_id: state.currentGuestId,
      p_next_invalid_attempts: state.invalidAttempts,
      p_inbound_event_id: inboundId,
      p_outbound_action: outboundAction,
      p_outbound_guest_id: outboundGuestId,
    })
    if (error) throw new Error(`conversation_update:${error.message}`)
    if (!data) throw new Error("conversation_update:state_changed")
  }

  async applyAttendanceAndAdvance(
    conversationId: string,
    guestId: string,
    status: "attending" | "declined",
    nextState: ReminderState,
    inboundId: string,
    outboundAction: WhatsAppOutboundAction,
    outboundGuestId: string | null,
  ) {
    const { error } = await this.client.rpc("advance_whatsapp_attendance", {
      p_conversation_id: conversationId,
      p_guest_id: guestId,
      p_status: status,
      p_next_state: nextState.mode,
      p_next_guest_id: nextState.currentGuestId,
      p_invalid_attempts: nextState.invalidAttempts,
      p_inbound_event_id: inboundId,
      p_outbound_action: outboundAction,
      p_outbound_guest_id: outboundGuestId,
    })
    if (error) throw new Error(`attendance_update:${error.message}`)
  }

  async refreshConversation(conversationId: string): Promise<
    Array<{
      id: string
      name: string
      attendanceStatus: "pending" | "attending" | "declined"
    }>
  > {
    const { data, error } = await this.client
      .from("whatsapp_conversations")
      .select("id,invitation_groups!inner(guests(id,name,attendance_status,created_at))")
      .eq("id", conversationId)
      .single()
    if (error) throw new Error(`conversation_refresh:${error.message}`)
    return [...((data as any).invitation_groups.guests ?? [])]
      .sort((left: any, right: any) =>
        String(left.created_at).localeCompare(String(right.created_at)) || String(left.id).localeCompare(String(right.id)),
      )
      .map((guest: any) => ({
        id: guest.id,
        name: guest.name,
        attendanceStatus: guest.attendance_status as "pending" | "attending" | "declined",
      }))
  }

  async suppressPhone(phoneE164: string, inboundId: string, eventId?: string) {
    const { error } = await this.client.rpc("suppress_whatsapp_phone", {
      p_phone_e164: phoneE164,
      p_phone_hash: this.hashPhone(phoneE164),
      p_event_id: eventId ?? null,
      p_inbound_event_id: inboundId,
    })
    if (error) throw new Error(`suppress:${error.message}`)
  }

  async isSuppressed(phoneE164: string) {
    const { data, error } = await this.client
      .from("phone_suppressions")
      .select("phone_e164")
      .eq("phone_e164", phoneE164)
      .maybeSingle()
    if (error) throw new Error(`suppression_check:${error.message}`)
    return Boolean(data)
  }

  async recordMissingTableAlerts(context: DeliveryContext, guestIds: string[]) {
    if (guestIds.length === 0) return
    const { error } = await this.client.from("message_campaign_alerts").upsert(
      guestIds.map((guestId) => ({
        campaign_id: context.campaignId,
        event_id: context.eventId,
        group_id: context.groupId,
        guest_id: guestId,
        code: "missing_table",
        resolved_at: null,
      })),
      { onConflict: "campaign_id,guest_id,code" },
    )
    if (error) throw new Error(`missing_table_alert:${error.message}`)
  }

  async resolveInbound(inboundId: string, resolution: string, conversationId?: string) {
    let query = this.client
      .from("whatsapp_inbound_events")
      .update({
        resolution,
        conversation_id: conversationId ?? null,
        processed_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        processing_error_code: null,
      })
      .eq("id", inboundId)
    query = resolution === "review"
      ? query.in("resolution", ["pending", "applied"])
      : query.eq("resolution", "pending")
    const { error } = await query
    if (error) throw new Error(`inbound_resolve:${error.message}`)
  }

  async storePairingQr(qr: string | null) {
    if (!qr) {
      const { error } = await this.client
        .from("whatsapp_auth_state")
        .delete()
        .eq("storage_key", "pairing_qr")
      if (error) throw new Error(`pairing_qr_clear:${error.message}`)
      return
    }
    const { error } = await this.client.from("whatsapp_auth_state").upsert(
      {
        storage_key: "pairing_qr",
        encrypted_value: encryptSecret(qr, this.encryptionKey),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "storage_key" },
    )
    if (error) throw new Error(`pairing_qr_store:${error.message}`)
  }

  private hashPhone(phoneE164: string) {
    return createHmac("sha256", this.hashingSecret).update(phoneE164).digest("hex")
  }

  private async refreshCampaignStatus(campaignId: string) {
    const { count, error } = await this.client
      .from("message_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["queued", "sending", "failed"])
    if (error) throw new Error(`campaign_delivery_count:${error.message}`)
    if ((count ?? 0) === 0) {
      const { error: updateError } = await this.client
        .from("message_campaigns")
        .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", campaignId)
        .in("status", ["queued", "running"])
      if (updateError) throw new Error(`campaign_complete:${updateError.message}`)
    } else {
      const { error: updateError } = await this.client
        .from("message_campaigns")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", campaignId)
        .eq("status", "queued")
      if (updateError) throw new Error(`campaign_start:${updateError.message}`)
    }
  }
}

export type { ConversationView, InboundWork }

function deserializeInboundCommand(command: string, payload: unknown): InboundCommand {
  if (command === "select") {
    const index = (payload as { index?: unknown } | null)?.index
    return Number.isInteger(index) && Number(index) >= 0
      ? { type: "select", index: Number(index) }
      : { type: "unknown" }
  }
  if (["accept", "decline", "change", "stop", "unknown"].includes(command)) {
    return { type: command as "accept" | "decline" | "change" | "stop" | "unknown" }
  }
  return { type: "unknown" }
}

function inboundErrorCode(error: unknown) {
  const prefix = (error instanceof Error ? error.message : "unknown")
    .split(":", 1)[0]
    .replace(/[^A-Za-z0-9_]/g, "_")
    .toUpperCase()
    .slice(0, 64)
  return prefix || "UNKNOWN"
}

function sanitizeOperationalDetail(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown"
  return message
    .replace(/\+\d{8,15}/g, "[phone]")
    .replace(/\d{8,15}@(s\.whatsapp\.net|lid)/gi, "[jid]")
    .slice(0, 500)
}
