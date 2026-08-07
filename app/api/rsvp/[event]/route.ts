import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import path from "node:path"
import { promises as fs } from "node:fs"
import { access } from "node:fs/promises"
import { getRsvpLifecycleStatus } from "@/lib/invitations/lifecycle"
import { getInvitationByLegacyRsvpEvent } from "@/lib/invitations/registry"
import { z } from "zod"
import { assertMutationRequest } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { enforceRateLimit } from "@/lib/crm/rate-limit"
import { PUBLIC_RSVP_RATE_LIMITS } from "@/lib/crm/rate-limit-policies"
import { stableHash } from "@/lib/crm/tokens"
import { serializeCsv } from "@/lib/csv-export"
import { logLegacyDatabaseError, parseLegacyJson } from "@/lib/legacy-admin-api"
import { inspectLegacyRsvpRelation } from "@/lib/legacy-rsvp-relation"

const FALLBACK_DIR = path.join(process.cwd(), "data")

const legacyRsvpSchema = z.object({
  name: z.string().trim().max(160).optional(),
  attendance: z.string().trim().max(40).optional(),
  dietaryPreferences: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  favoriteSong: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(254).or(z.literal("")).optional(),
  drink: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  isSaveTheDate: z.boolean().optional(),
}).strict()

type RsvpPayload = z.infer<typeof legacyRsvpSchema>

type RouteContext = {
  params: Promise<{
    event: string
  }>
}

export async function POST(request: Request, { params }: RouteContext) {
  const { event } = await params
  const invitation = getInvitationByLegacyRsvpEvent(event)
  if (!invitation) {
    return NextResponse.json({ error: "Evento desconocido." }, { status: 404 })
  }

  let tableName = invitation.legacy.rsvpTable
  let lifecycleDefinition = invitation
  let canonicalEventId: string | null = null

  try {
    assertMutationRequest(request)
    if (supabaseAdmin) {
      await enforceRateLimit({
        request,
        namespace: PUBLIC_RSVP_RATE_LIMITS.write.namespace,
        scope: invitation.eventKey,
        limit: PUBLIC_RSVP_RATE_LIMITS.write.limit,
        windowSeconds: PUBLIC_RSVP_RATE_LIMITS.write.windowSeconds,
      })

      const { data: eventRow, error: eventError } = await supabaseAdmin
        .from("events")
        .select("id,event_at,timezone,rsvp_status,rsvp_opens_at,rsvp_deadline,legacy_table_name")
        .eq("slug", invitation.eventKey)
        .maybeSingle()
      if (eventError) {
        logLegacyDatabaseError("load_public_rsvp_event", eventError)
        return NextResponse.json(
          { error: "El servicio de confirmaciones no está disponible." },
          { status: 503 },
        )
      }
      if (!eventRow) {
        return NextResponse.json({ error: "Evento desconocido." }, { status: 404 })
      }
      if (!eventRow.legacy_table_name) {
        return NextResponse.json(
          { error: "El servicio de confirmaciones no está disponible." },
          { status: 503 },
        )
      }
      if (eventRow.legacy_table_name !== invitation.legacy.rsvpTable) {
        console.error("Rejected mismatched public RSVP mapping")
        return NextResponse.json(
          { error: "El servicio de confirmaciones no está disponible." },
          { status: 503 },
        )
      }
      let tableInspection
      try {
        tableInspection = await inspectLegacyRsvpRelation(
          eventRow.legacy_table_name,
        )
      } catch (error) {
        console.error("Unable to inspect legacy RSVP relation", {
          kind: error instanceof Error ? error.name : typeof error,
        })
        return NextResponse.json(
          { error: "El servicio de confirmaciones no está disponible." },
          { status: 503 },
        )
      }
      if (!tableInspection.valid) {
        console.error("Rejected unsafe public RSVP mapping")
        return NextResponse.json(
          { error: "El servicio de confirmaciones no está disponible." },
          { status: 503 },
        )
      }
      const { data: migrationState, error: migrationStateError } =
        await supabaseAdmin
          .from("event_migration_state")
          .select("legacy_reads_enabled,legacy_dual_write_enabled")
          .eq("event_id", eventRow.id)
          .maybeSingle()
      if (migrationStateError || !migrationState) {
        if (migrationStateError) {
          logLegacyDatabaseError("load_public_rsvp_migration_state", migrationStateError)
        } else {
          console.error("Public RSVP migration state is missing")
        }
        return NextResponse.json(
          { error: "El servicio de confirmaciones no está disponible." },
          { status: 503 },
        )
      }
      if (
        migrationState.legacy_reads_enabled !== true ||
        migrationState.legacy_dual_write_enabled !== true
      ) {
        const code = migrationState.legacy_reads_enabled === false
          ? "LEGACY_CUTOVER_COMPLETE"
          : "LEGACY_DUAL_WRITE_DISABLED"
        return NextResponse.json(
          {
            error: "Esta invitación usa el nuevo servicio de confirmaciones.",
            code,
            eventId: eventRow.id,
            canonicalEndpoint: `/api/events/${invitation.eventKey}/rsvp`,
          },
          { status: 409 },
        )
      }
      canonicalEventId = eventRow.id
      tableName = tableInspection.tableName
      lifecycleDefinition = {
        ...invitation,
        event: {
          startsAt: eventRow.event_at,
          timezone: eventRow.timezone,
        },
        rsvp: {
          ...invitation.rsvp,
          status: eventRow.rsvp_status,
          opensAt: eventRow.rsvp_opens_at,
          closesAt: eventRow.rsvp_deadline,
        },
      }
    }
  } catch (error) {
    return crmErrorResponse(error)
  }

  if (
    !supabaseAdmin &&
    (process.env.NODE_ENV !== "development" ||
      process.env.ENABLE_CSV_RSVP_ADAPTER !== "true")
  ) {
    return NextResponse.json(
      { error: "El servicio de confirmaciones no está disponible." },
      { status: 503 },
    )
  }

  if (getRsvpLifecycleStatus(lifecycleDefinition) !== "open") {
    return NextResponse.json(
      { error: "El período de confirmación de asistencia finalizó." },
      { status: 410 },
    )
  }

  const parsed = await parseLegacyJson(request, legacyRsvpSchema, 64 * 1024)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }
  const payload = parsed.data
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? ""
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return NextResponse.json(
      { error: "Falta una clave de idempotencia válida." },
      { status: 400 },
    )
  }

  const { name, attendance, isSaveTheDate = false } = payload

  if (
    !isSaveTheDate &&
    (!(name ?? "").trim() || !(attendance ?? "").trim())
  ) {
    return NextResponse.json(
      { error: "El nombre y la respuesta de asistencia son obligatorios." },
      { status: 400 }
    )
  }

  const dietaryPreferences = payload.dietaryPreferences ?? []
  const favoriteSong = payload.favoriteSong ?? ""
  const email = payload.email ?? ""
  const drink = payload.drink ?? []

  const nameForStore = (name ?? "").trim()
  const attendanceForStore = (attendance ?? "").trim()
  const resolvedName = nameForStore || (isSaveTheDate ? "—" : "")
  const resolvedAttendance =
    attendanceForStore || (isSaveTheDate ? "save_the_date" : "")

  if (supabaseAdmin) {
    if (!canonicalEventId) {
      return NextResponse.json(
        { error: "El servicio de confirmaciones no está disponible." },
        { status: 503 },
      )
    }
    const insertData = buildSupabaseInsertPayload(payload, tableName)

    const { data, error } = await supabaseAdmin.rpc("submit_legacy_rsvp_idempotent", {
      p_event_id: canonicalEventId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: stableHash({ eventId: canonicalEventId, payload: insertData }),
      p_payload: insertData,
    })

    if (error) {
      logLegacyDatabaseError("submit_public_rsvp", error)
      if (error.message.includes("idempotency_key_reused")) {
        return NextResponse.json(
          { error: "La clave de idempotencia ya fue usada con otros datos." },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: "Hubo un error al guardar tu respuesta. Intenta nuevamente." },
        { status: 503 },
      )
    }

    return NextResponse.json({
      ok: true,
      idempotentReplay: Boolean((data as { idempotentReplay?: boolean } | null)?.idempotentReplay),
    })
  }

  if (
    process.env.NODE_ENV !== "development" ||
    process.env.ENABLE_CSV_RSVP_ADAPTER !== "true"
  ) {
    return NextResponse.json(
      { error: "El servicio de confirmaciones no está disponible." },
      { status: 503 },
    )
  }

  await persistToCsv(event, {
    name: resolvedName,
    attendance: resolvedAttendance,
    dietaryPreferences,
    favoriteSong,
    email,
    drink,
  })
  return NextResponse.json({ ok: true, fallback: true })
}

async function persistToCsv(
  eventKey: string,
  data: {
    name: string
    attendance: string
    dietaryPreferences: string[]
    favoriteSong: string
    email: string
    drink: string[]
  },
) {
  await fs.mkdir(FALLBACK_DIR, { recursive: true })
  const filePath = path.join(FALLBACK_DIR, `${eventKey}-rsvps.csv`)
  const header = [
    "timestamp",
    "name",
    "attendance",
    "dietaryPreferences",
    "favoriteSong",
    "email",
  ]
  const dietaryValue = data.dietaryPreferences.join("; ")
  const row = [
    new Date().toISOString(),
    data.name.trim(),
    data.attendance,
    dietaryValue,
    data.favoriteSong.trim(),
    data.email.trim(),
  ]

  let content: string
  try {
    await access(filePath)
    content = `${serializeCsv([row], { bom: false })}\r\n`
  } catch {
    content = `${serializeCsv([header, row])}\r\n`
  }

  await fs.appendFile(filePath, content, "utf8")
}

/** Solo columnas presentes en el JSON del cliente (no defaults vacíos). */
function buildSupabaseInsertPayload(
  payload: RsvpPayload,
  tableName: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  const has = (key: keyof RsvpPayload) =>
    Object.prototype.hasOwnProperty.call(payload, key)

  if (has("name")) {
    const v = (payload.name ?? "").trim()
    if (v) row.name = v
  }
  if (has("attendance")) {
    const v = (payload.attendance ?? "").trim()
    if (v) row.attendance = v
  }
  if (has("dietaryPreferences") && Array.isArray(payload.dietaryPreferences)) {
    row.dietary_preferences = payload.dietaryPreferences
  }
  if (has("drink") && Array.isArray(payload.drink)) {
    const drinks = payload.drink.filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    )
    if (drinks.length > 0) row.drink = drinks
  }
  if (has("favoriteSong")) {
    const v = (payload.favoriteSong ?? "").trim()
    if (v) {
      row.favorite_song =
        tableName === "save_the_date_mica_santi" ? [v] : v
    }
  }
  if (has("email")) {
    const v = (payload.email ?? "").trim()
    if (v) row.email = v
  }

  return row
}
