import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import path from "node:path"
import { promises as fs } from "node:fs"
import { access } from "node:fs/promises"

const EVENT_TABLES: Record<string, string> = {
  bodaSofiGonchi: "boda_sofi_gonchi_rsvps",
  bodaMicaTincho: "boda_mica_tincho_rsvps",
  bodaVirJere: "boda_vir_jere",
  bodaAndresLucre: "boda_andres_lucre",
  bodaDomiDiego: "boda_domi_diego",
  bodaMicaSanti: "boda_mica_santi",

}

const FALLBACK_DIR = path.join(process.cwd(), "data")

type RsvpPayload = {
  name?: string
  attendance?: string
  dietaryPreferences?: string[]
  favoriteSong?: string
  email?: string
  drink?: string[]
  isSaveTheDate?: boolean
}

type RouteContext = {
  params: Promise<{
    event: string
  }>
}

export async function POST(request: Request, { params }: RouteContext) {
  const { event } = await params
  const tableName = EVENT_TABLES[event]

  let payload: RsvpPayload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Formato inválido." }, { status: 400 })
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

  if (tableName && supabaseAdmin) {
    const insertData = buildSupabaseInsertPayload(payload, tableName)

    const { error } = await supabaseAdmin.from(tableName).insert(insertData)

    if (error) {
      console.error(`Supabase RSVP insert error for ${event}:`, {
        tableName,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json(
        {
          error: "Hubo un error al guardar tu respuesta. Intenta nuevamente.",
          ...(process.env.NODE_ENV === "development" && {
            debug: {
              tableName,
              code: error.code,
              message: error.message,
            },
          }),
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
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
  const header =
    "timestamp,name,attendance,dietaryPreferences,favoriteSong,email\n"
  const dietaryValue = data.dietaryPreferences.join("; ")
  const row =
    [
      new Date().toISOString(),
      toCsvField(data.name.trim()),
      toCsvField(data.attendance),
      toCsvField(dietaryValue),
      toCsvField(data.favoriteSong.trim()),
      toCsvField(data.email.trim()),
    ].join(",") + "\n"

  let prefix = ""
  try {
    await access(filePath)
  } catch {
    prefix = header
  }

  await fs.appendFile(filePath, `${prefix}${row}`, "utf8")
}

function toCsvField(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ""
  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
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

