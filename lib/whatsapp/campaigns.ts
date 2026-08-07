import type { SupabaseClient } from "@supabase/supabase-js"
import { CrmError, unavailable } from "@/lib/crm/errors"
import { listInvitationGroups } from "@/lib/crm/service"
import { stableHash } from "@/lib/crm/tokens"
import type { CampaignKind, CampaignPreviewGroup } from "@/lib/crm/types"
import { supabaseAdmin } from "@/lib/supabase"

function db(): SupabaseClient {
  if (!supabaseAdmin) throw unavailable("Supabase no configurado")
  return supabaseAdmin
}

export async function previewCampaign(input: {
  eventId: string
  kind: CampaignKind
  groupIds?: string[]
  customMessage?: string
}) {
  const selectedIds = input.groupIds ? new Set(input.groupIds) : null
  const groups = (await listInvitationGroups(input.eventId)).filter(
    (group) => !selectedIds || selectedIds.has(group.id),
  )
  const phones = groups.flatMap((group) => (group.phoneE164 ? [group.phoneE164] : []))

  const [suppressionsResult, sentResult, staleResult] = await Promise.all([
    phones.length > 0
      ? db().from("phone_suppressions").select("phone_e164").in("phone_e164", phones)
      : Promise.resolve({ data: [], error: null }),
    db()
      .from("message_deliveries")
      .select("group_id,message_campaigns!inner(kind)")
      .eq("event_id", input.eventId)
      .neq("status", "cancelled")
      .eq("message_campaigns.kind", input.kind),
    input.kind === "table_correction"
      ? db()
          .from("message_deliveries")
          .select("group_id,message_campaigns!inner(kind)")
          .eq("event_id", input.eventId)
          .eq("is_stale", true)
          .in("message_campaigns.kind", ["table_notice", "table_correction"])
      : Promise.resolve({ data: [], error: null }),
  ])

  if (suppressionsResult.error) throw unavailable(suppressionsResult.error.message)
  if (sentResult.error) throw unavailable(sentResult.error.message)
  if (staleResult.error) throw unavailable(staleResult.error.message)

  const suppressed = new Set((suppressionsResult.data ?? []).map((row) => row.phone_e164))
  const alreadySent = new Set((sentResult.data ?? []).map((row) => row.group_id))
  const staleGroups = new Set((staleResult.data ?? []).map((row) => row.group_id))

  const rows: CampaignPreviewGroup[] = groups.map((group) => {
    const base = {
      groupId: group.id,
      displayName: group.displayName,
      phoneE164: group.phoneE164,
      guests: group.guests.map((guest) => ({
        id: guest.id,
        name: guest.name,
        attendanceStatus: guest.attendanceStatus,
        tableLabel: guest.tableLabel ?? null,
      })),
    }

    if (!group.phoneE164) return { ...base, eligible: false, reason: "missing_phone" as const }
    if (!group.consentAt) return { ...base, eligible: false, reason: "missing_consent" as const }
    if (suppressed.has(group.phoneE164)) return { ...base, eligible: false, reason: "suppressed" as const }
    if (alreadySent.has(group.id) && input.kind !== "table_correction") {
      return { ...base, eligible: false, reason: "already_sent" as const }
    }
    if (input.kind === "table_correction" && !staleGroups.has(group.id)) {
      return { ...base, eligible: false, reason: "not_stale" as const }
    }

    if (input.kind === "reminder" && !group.guests.some((guest) => guest.attendanceStatus === "pending")) {
      return { ...base, eligible: false, reason: "no_pending_guests" as const }
    }

    if (input.kind === "table_notice" || input.kind === "table_correction") {
      const attending = group.guests.filter((guest) => guest.attendanceStatus === "attending")
      if (attending.length === 0) {
        return { ...base, eligible: false, reason: "no_attending_guests" as const }
      }
      if (!attending.some((guest) => guest.tableId && guest.tableLabel)) {
        return { ...base, eligible: false, reason: "missing_table" as const }
      }
    }

    return { ...base, eligible: true, reason: "eligible" as const }
  })

  const canonical = {
    kind: input.kind,
    customMessage: input.customMessage?.trim() || null,
    groups: rows.map(({ groupId, displayName, phoneE164, eligible, reason, guests }) => ({
      groupId,
      displayName,
      phoneE164,
      eligible,
      reason,
      guests: guests.map(({ id, name, attendanceStatus, tableLabel }) => ({
        id,
        name,
        attendanceStatus,
        tableLabel,
      })),
    })),
  }
  return {
    kind: input.kind,
    groups: rows,
    eligibleCount: rows.filter((row) => row.eligible).length,
    omittedCount: rows.filter((row) => !row.eligible).length,
    previewHash: stableHash(canonical),
  }
}

export async function createCampaign(input: {
  eventId: string
  kind: CampaignKind
  groupIds?: string[]
  idempotencyKey: string
  customMessage?: string
  scheduledFor?: string
  confirmedPreviewHash: string
  requestedByAdminId: string
}) {
  const requestHash = stableHash({
    eventId: input.eventId,
    kind: input.kind,
    groupIds: input.groupIds ? [...input.groupIds].sort() : null,
    customMessage: input.customMessage?.trim() || null,
    scheduledFor: input.scheduledFor ? new Date(input.scheduledFor).toISOString() : null,
    confirmedPreviewHash: input.confirmedPreviewHash,
  })
  const replayBeforePreview = await findCampaignReplay(input, requestHash)
  if (replayBeforePreview) return { ...replayBeforePreview, preview: null }

  const preview = await previewCampaign(input)
  if (preview.previewHash !== input.confirmedPreviewHash) {
    // Covers the race where the original request committed after the lookup
    // above but before this preview observed its deliveries.
    const racedReplay = await findCampaignReplay(input, requestHash)
    if (racedReplay) return { ...racedReplay, preview: null }
    throw new CrmError(
      "La lista de destinatarios cambió. Revisá la nueva previsualización.",
      "PREVIEW_CHANGED",
      409,
      preview,
    )
  }
  if (preview.eligibleCount === 0) {
    const racedReplay = await findCampaignReplay(input, requestHash)
    if (racedReplay) return { ...racedReplay, preview: null }
    throw new CrmError("No hay destinatarios elegibles.", "NO_ELIGIBLE_RECIPIENTS", 422, preview)
  }

  const { data, error } = await db().rpc("create_message_campaign", {
    p_event_id: input.eventId,
    p_kind: input.kind,
    p_group_ids: preview.groups.filter((group) => group.eligible).map((group) => group.groupId),
    p_idempotency_key: input.idempotencyKey,
    p_preview_hash: input.confirmedPreviewHash,
    p_custom_message: input.customMessage ?? null,
    p_scheduled_for: input.scheduledFor ?? null,
    p_request_hash: requestHash,
    p_requested_by: input.requestedByAdminId,
  })

  if (error) {
    if (error.message.includes("no_recipients_after_recheck")) {
      throw new CrmError(
        "Los destinatarios ya pertenecen a otra campaña activa o enviada.",
        "RECIPIENTS_CHANGED",
        409,
      )
    }
    if (error.message.includes("idempotency_key_reused")) {
      throw new CrmError(
        "La clave de idempotencia ya fue usada para otra campaña.",
        "IDEMPOTENCY_KEY_REUSED",
        409,
      )
    }
    throw unavailable(error.message)
  }

  const rpcResult = data as {
    campaign: Record<string, unknown>
    idempotentReplay?: boolean
    idempotent_replay?: boolean
  }
  return {
    campaign: rpcResult.campaign,
    idempotentReplay: rpcResult.idempotentReplay ?? rpcResult.idempotent_replay ?? false,
    preview,
  }
}

async function findCampaignReplay(
  input: {
    eventId: string
    kind: CampaignKind
    groupIds?: string[]
    idempotencyKey: string
    customMessage?: string
    scheduledFor?: string
    confirmedPreviewHash: string
  },
  requestHash: string,
) {
  const { data, error } = await db()
    .from("message_campaigns")
    .select("id,event_id,kind,status,scheduled_for,custom_message,idempotency_key,preview_hash,metadata,created_at")
    .eq("event_id", input.eventId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle()
  if (error) throw unavailable(error.message)
  if (!data) return null

  const storedRequestHash = (data.metadata as { requestHash?: unknown } | null)?.requestHash
  if (
    data.kind !== input.kind ||
    data.preview_hash !== input.confirmedPreviewHash ||
    storedRequestHash !== requestHash
  ) {
    throw new CrmError(
      "La clave de idempotencia ya fue usada para otra campaña.",
      "IDEMPOTENCY_KEY_REUSED",
      409,
    )
  }
  return { campaign: data, idempotentReplay: true as const }
}

export async function listCampaigns(eventId: string) {
  const { data, error } = await db()
    .from("message_campaigns")
    .select("id,event_id,kind,status,scheduled_for,custom_message,idempotency_key,preview_hash,created_at,message_deliveries(status,is_stale,error_code,payload),message_campaign_alerts(id,group_id,guest_id,code,resolved_at,created_at)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw unavailable(error.message)
  return data ?? []
}
