import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import path from "node:path"
import { promises as fs } from "node:fs"
import { access } from "node:fs/promises"

const EVENT_TABLES: Record<string, string> = {
  bodaSofiGonchi: "boda_sofi_gonchi_rsvps",
  bodaMicaTincho: "boda_mica_tincho_rsvps",
  bodaVirJere: "boda_vir_jere",
}

const FALLBACK_DIR = path.join(process.cwd(), "data")

type RsvpPayload = {
  name?: string
  attendance?: string
  dietaryPreferences?: string[]
  favoriteSong?: string
}

type RouteContext = {
  params: Promise<{
    event: string
  }>
}

export async function POST(request: Request, { params }: RouteContext) {
  const { event } = await params
  const tableName = EVENT_TABLES[event]

  console.log('flo llega aca 0')

  let payload: RsvpPayload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Formato inválido." }, { status: 400 })
  }

  const { name, attendance, dietaryPreferences = [], favoriteSong = "" } = payload

  if (!name || !attendance) {
    return NextResponse.json(
      { error: "El nombre y la respuesta de asistencia son obligatorios." },
      { status: 400 }
    )
  }

  console.log('flo llega aca 1')

  if (tableName && supabaseAdmin) {
    const insertData: Record<string, any> = {
      name: name.trim(),
      attendance,
      dietary_preferences: dietaryPreferences,
    }

    // Solo incluir favorite_song si está presente y no está vacío
    if (favoriteSong && favoriteSong.trim()) {
      insertData.favorite_song = favoriteSong.trim()
    }

    const { error } = await supabaseAdmin.from(tableName).insert(insertData)

    if (error) {
      console.log('flo llega aca 2')
      console.error(`Supabase RSVP insert error for ${event}:`, error)
      return NextResponse.json(
        { error: "Hubo un error al guardar tu respuesta. Intenta nuevamente." },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  }

  await persistToCsv(event, { name, attendance, dietaryPreferences, favoriteSong })
  return NextResponse.json({ ok: true, fallback: true })
}

async function persistToCsv(
  eventKey: string,
  data: { name: string; attendance: string; dietaryPreferences: string[]; favoriteSong: string }
) {
  await fs.mkdir(FALLBACK_DIR, { recursive: true })
  const filePath = path.join(FALLBACK_DIR, `${eventKey}-rsvps.csv`)
  const header = "timestamp,name,attendance,dietaryPreferences,favoriteSong\n"
  const dietaryValue = data.dietaryPreferences.join("; ")
  const row =
    [
      new Date().toISOString(),
      toCsvField(data.name.trim()),
      toCsvField(data.attendance),
      toCsvField(dietaryValue),
      toCsvField(data.favoriteSong.trim()),
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

