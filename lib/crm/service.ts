import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createInvitationGroupResult,
  importGuestCsvResult,
} from "@/lib/crm/admin-results"
import { previewGuestCsv } from "@/lib/crm/csv"
import { CrmError, unavailable } from "@/lib/crm/errors"
import { normalizePhone } from "@/lib/crm/phone"
import { createInvitationToken, hashInvitationToken, stableHash } from "@/lib/crm/tokens"
import type {
  AttendanceStatus,
  GuestImportPreview,
  InvitationGroup,
} from "@/lib/crm/types"
import { supabaseAdmin } from "@/lib/supabase"
import { encryptSecret } from "@/lib/whatsapp/crypto"

type DbGroup = {
  id: string
  event_id: string
  display_name: string
  phone_e164: string | null
  consent_at: string | null
  consent_source: InvitationGroup["consentSource"]
  created_at: string
  guests?: Array<
    DbGuest & {
      guest_tags?: Array<{
        tags: { id: string; event_id: string; name: string; color: string | null } | null
      }> | null
    }
  > | null
}

type DbGuest = {
  id: string
  event_id: string
  group_id: string
  name: string
  attendance_status: AttendanceStatus
  attendance_source: InvitationGroup["guests"][number]["attendanceSource"]
  table_id: string | null
  dietary_preferences: string[] | null
  favorite_song: string | null
  drink_preferences: string[] | null
  created_at: string
  updated_at: string
  seating_tables?: { label?: string | null; code?: string | null } | null
}

function db(): SupabaseClient {
  if (!supabaseAdmin) throw unavailable("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados")
  return supabaseAdmin
}

function encryptionSecret() {
  const secret = process.env.INVITIA_ENCRYPTION_KEY
  if (!secret || Buffer.byteLength(secret.trim(), "utf8") < 32) {
    throw unavailable("INVITIA_ENCRYPTION_KEY no configurada o insegura")
  }
  return secret
}

function mapGroup(row: DbGroup): InvitationGroup {
  const tagsById = new Map<string, { id: string; event_id: string; name: string; color: string | null }>()
  for (const guest of row.guests ?? []) {
    for (const entry of guest.guest_tags ?? []) {
      if (entry.tags) tagsById.set(entry.tags.id, entry.tags)
    }
  }
  return {
    id: row.id,
    eventId: row.event_id,
    displayName: row.display_name,
    phoneE164: row.phone_e164,
    consentAt: row.consent_at,
    consentSource: row.consent_source,
    createdAt: row.created_at,
    tags: Array.from(tagsById.values()).map((tag) => ({
      id: tag.id,
      eventId: tag.event_id,
      name: tag.name,
      color: tag.color,
    })),
    guests: [...(row.guests ?? [])].sort((left, right) =>
      left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
    ).map((guest) => ({
      id: guest.id,
      eventId: guest.event_id,
      groupId: guest.group_id,
      name: guest.name,
      attendanceStatus: guest.attendance_status,
      attendanceSource: guest.attendance_source,
      tableId: guest.table_id,
      tableLabel: guest.seating_tables?.label ?? guest.seating_tables?.code ?? null,
      dietaryPreferences: guest.dietary_preferences ?? [],
      favoriteSong: guest.favorite_song,
      drinkPreferences: guest.drink_preferences ?? [],
      createdAt: guest.created_at,
      updatedAt: guest.updated_at,
    })),
  }
}

const GROUP_SELECT = `
  id,event_id,display_name,phone_e164,consent_at,consent_source,created_at,
  guests(
    id,event_id,group_id,name,attendance_status,attendance_source,table_id,
    dietary_preferences,favorite_song,drink_preferences,created_at,updated_at,
    seating_tables(label,code),guest_tags(tags(id,event_id,name,color))
  )
`

export async function listInvitationGroups(eventId: string) {
  const { data, error } = await db()
    .from("invitation_groups")
    .select(GROUP_SELECT)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })

  if (error) throw unavailable(error.message)
  return (data as unknown as DbGroup[]).map(mapGroup)
}

export async function createInvitationGroup(input: {
  eventId: string
  groupName: string
  groupKey?: string
  phone: string
  consent: boolean
  consentSource: "manual" | "csv" | "rsvp" | "legacy"
  idempotencyKey: string
  labels: string[]
  members: Array<{ name: string; attendanceStatus: AttendanceStatus }>
}) {
  const phone = normalizePhone(input.phone)
  if (!phone.ok) throw new CrmError("El teléfono no es válido.", "INVALID_PHONE", 400)
  const invitationToken = createInvitationToken()
  const secret = encryptionSecret()
  const tokenCiphertext = encryptSecret(invitationToken.token, secret)
  const requestHash = stableHash({
    eventId: input.eventId,
    groupName: input.groupName,
    groupKey: input.groupKey?.trim() || null,
    phoneE164: phone.phoneE164,
    consent: input.consent,
    consentSource: input.consentSource,
    labels: input.labels,
    members: input.members,
  })

  const { data, error } = await db().rpc("crm_create_invitation_group_idempotent", {
    p_event_id: input.eventId,
    p_display_name: input.groupName,
    p_group_key: input.groupKey ?? null,
    p_phone_e164: phone.phoneE164,
    p_consent_at: input.consent ? new Date().toISOString() : null,
    p_consent_source: input.consentSource,
    p_token_hash: invitationToken.hash,
    p_token_last4: invitationToken.last4,
    p_token_ciphertext: tokenCiphertext,
    p_members: input.members,
    p_labels: input.labels,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: requestHash,
  })

  if (error) {
    if (error.message.includes("idempotency_key_reused")) {
      throw new CrmError(
        "La clave de idempotencia ya fue usada con otros datos.",
        "IDEMPOTENCY_KEY_REUSED",
        409,
      )
    }
    if (error.code === "23505") {
      throw new CrmError("El teléfono ya existe en este evento.", "DUPLICATE_PHONE", 409)
    }
    throw unavailable(error.message)
  }

  const rpcResult = data as {
    result: { groupId: string }
    idempotentReplay?: boolean
  }
  return createInvitationGroupResult(
    rpcResult.result.groupId,
    rpcResult.idempotentReplay,
  )
}

export async function previewCsvForEvent(
  eventId: string,
  csv: string,
  defaultCallingCode = "598",
): Promise<GuestImportPreview> {
  const { data, error } = await db()
    .from("invitation_groups")
    .select("phone_e164")
    .eq("event_id", eventId)
    .not("phone_e164", "is", null)

  if (error) throw unavailable(error.message)
  return previewGuestCsv(csv, {
    defaultCallingCode,
    existingPhones: (data ?? []).flatMap((row) => (row.phone_e164 ? [row.phone_e164] : [])),
  })
}

export async function importGuestCsv(
  eventId: string,
  csv: string,
  idempotencyKey: string,
  defaultCallingCode = "598",
) {
  // Validate the file itself here, but let the transactional insert enforce
  // database duplicates. That is essential for a retry after a committed
  // import whose HTTP response was lost: its own phones now exist, while the
  // idempotency wrapper must still be allowed to replay the original result.
  const preview = previewGuestCsv(csv, { defaultCallingCode })
  if (preview.invalidRows > 0 || preview.validRows === 0) {
    throw new CrmError(
      preview.validRows === 0
        ? "El CSV no contiene invitados válidos."
        : "Corregí las filas inválidas antes de importar.",
      "INVALID_IMPORT",
      422,
      preview,
    )
  }

  const grouped = new Map<
    string,
    {
      groupName: string
      groupKey?: string
      phone: string
      consent: boolean
      labels: Set<string>
      members: Array<{ name: string; attendanceStatus: AttendanceStatus }>
    }
  >()

  for (const row of preview.rows) {
    if (!row.input) continue
    const key = row.input.groupKey ?? `row-${row.rowNumber}`
    const current = grouped.get(key) ?? {
      groupName: row.input.groupKey ?? row.input.name,
      groupKey: row.input.groupKey,
      phone: row.input.phone,
      consent: row.input.consent === true,
      labels: new Set<string>(),
      members: [],
    }
    row.input.labels?.forEach((label) => current.labels.add(label))
    current.members.push({ name: row.input.name, attendanceStatus: "pending" })
    grouped.set(key, current)
  }

  const payload = Array.from(grouped.entries()).map(([importKey, group]) => {
    const token = createInvitationToken()
    return {
      importKey,
      displayName: group.groupName,
      groupKey: group.groupKey ?? null,
      phoneE164: group.phone,
      consentAt: group.consent ? new Date().toISOString() : null,
      consentSource: "csv",
      tokenHash: token.hash,
      tokenLast4: token.last4,
      tokenCiphertext: encryptSecret(token.token, encryptionSecret()),
      labels: Array.from(group.labels),
      members: group.members,
    }
  })

  const requestHash = stableHash({
    eventId,
    defaultCallingCode,
    groups: payload.map((group) => ({
      importKey: group.importKey,
      displayName: group.displayName,
      groupKey: group.groupKey,
      phoneE164: group.phoneE164,
      consent: group.consentAt !== null,
      labels: group.labels,
      members: group.members,
    })),
  })

  const { data, error } = await db().rpc("crm_import_invitation_groups_idempotent", {
    p_event_id: eventId,
    p_groups: payload,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
  })
  if (error) {
    if (error.message.includes("idempotency_key_reused")) {
      throw new CrmError(
        "La clave de idempotencia ya fue usada con otro archivo o previsualización.",
        "IDEMPOTENCY_KEY_REUSED",
        409,
      )
    }
    if (error.code === "23505") {
      throw new CrmError("La importación contiene teléfonos duplicados.", "DUPLICATE_PHONE", 409)
    }
    throw unavailable(error.message)
  }

  const rpcResult = data as {
    result: Array<{ importKey: string; groupId: string }>
    idempotentReplay?: boolean
  }
  const importedByKey = new Map(rpcResult.result.map((row) => [row.importKey, row]))
  if (payload.some((group) => !importedByKey.get(group.importKey))) {
    throw unavailable("import_idempotency_response_incomplete")
  }
  const importedGroupIds = payload.map(
    (group) => importedByKey.get(group.importKey)?.groupId,
  )
  if (importedGroupIds.some((groupId) => !groupId)) {
    throw unavailable("import_idempotency_response_incomplete")
  }
  return importGuestCsvResult(
    importedGroupIds as string[],
    payload.reduce((sum, group) => sum + group.members.length, 0),
    rpcResult.idempotentReplay,
  )
}

export async function getPublicInvitationGroup(eventSlug: string, token: string) {
  const tokenHash = hashInvitationToken(token)
  const { data, error } = await db()
    .from("invitation_groups")
    .select(`${GROUP_SELECT},events!inner(slug,display_name,event_at,timezone,rsvp_status,rsvp_opens_at,rsvp_deadline)`)
    .eq("invitation_token_hash", tokenHash)
    .eq("events.slug", eventSlug)
    .maybeSingle()

  if (error) throw unavailable(error.message)
  if (!data) throw new CrmError("Invitación no encontrada.", "INVITATION_NOT_FOUND", 404)
  const row = data as unknown as DbGroup & {
    events: {
      slug: string
      display_name: string
      event_at: string
      timezone: string
      rsvp_status: "scheduled" | "open" | "closed"
      rsvp_opens_at: string | null
      rsvp_deadline: string | null
    }
  }
  const group = mapGroup(row)
  const now = Date.now()
  const startsAt = Date.parse(row.events.event_at)
  const opensAt = row.events.rsvp_opens_at ? Date.parse(row.events.rsvp_opens_at) : null
  const deadline = row.events.rsvp_deadline ? Date.parse(row.events.rsvp_deadline) : null
  const resolvedRsvpStatus =
    row.events.rsvp_status === "closed" ||
    (Number.isFinite(startsAt) && now >= startsAt) ||
    (deadline !== null && Number.isFinite(deadline) && now >= deadline)
      ? "closed"
      : opensAt !== null && Number.isFinite(opensAt) && now < opensAt
        ? "scheduled"
        : row.events.rsvp_status === "scheduled" && opensAt === null
          ? "scheduled"
          : "open"
  return {
    event: {
      slug: row.events.slug,
      displayName: row.events.display_name,
      eventAt: row.events.event_at,
      timezone: row.events.timezone,
      rsvpStatus: resolvedRsvpStatus,
      rsvpDeadline: row.events.rsvp_deadline,
    },
    group: {
      id: group.id,
      displayName: group.displayName,
      guests: group.guests,
    },
  }
}

export async function submitPublicRsvp(
  eventSlug: string,
  token: string,
  responses: Array<{
    guestId: string
    attendanceStatus: "attending" | "declined"
    dietaryPreferences?: string[]
    favoriteSong?: string
    drinkPreferences?: string[]
  }>,
) {
  const { data, error } = await db().rpc("submit_token_rsvp", {
    p_event_slug: eventSlug,
    p_token_hash: hashInvitationToken(token),
    p_responses: responses,
  })
  if (error) {
    if (error.message.includes("RSVP_CLOSED")) {
      throw new CrmError("La confirmación está cerrada.", "RSVP_CLOSED", 409)
    }
    if (error.message.includes("INVALID_TOKEN")) {
      throw new CrmError("Invitación no encontrada.", "INVITATION_NOT_FOUND", 404)
    }
    throw unavailable(error.message)
  }
  return data
}
