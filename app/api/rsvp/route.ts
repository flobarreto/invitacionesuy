import { NextResponse } from "next/server"
import path from "node:path"
import { promises as fs } from "node:fs"
import { existsSync } from "node:fs"

export const runtime = "nodejs"

const DATA_DIR = path.join(process.cwd(), "data")
const CSV_FILE = path.join(DATA_DIR, "boda-sofi-gonchi-rsvps.csv")
const CSV_HEADER = "timestamp,name,attendance,dietaryPreferences,favoriteSong\n"

const toCsvField = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return ""
  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export async function POST(request: Request) {
  let payload: {
    name?: string
    attendance?: string
    dietaryPreferences?: string[]
    favoriteSong?: string
  }

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

  await fs.mkdir(DATA_DIR, { recursive: true })

  const dietaryValue = Array.isArray(dietaryPreferences)
    ? dietaryPreferences.join("; ")
    : ""

  const row =
    [
      new Date().toISOString(),
      toCsvField(name.trim()),
      toCsvField(attendance),
      toCsvField(dietaryValue),
      toCsvField(favoriteSong?.trim() ?? ""),
    ].join(",") + "\n"

  const header = existsSync(CSV_FILE) ? "" : CSV_HEADER
  await fs.appendFile(CSV_FILE, `${header}${row}`, "utf8")

  return NextResponse.json({ ok: true })
}

