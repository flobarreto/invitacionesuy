import { tryParseJsonStringArray } from "@/lib/adminDrinks"

/** Normaliza favorite_song (string, array o JSON) a lista de canciones. */
export function extractSongsFromValue(raw: unknown): string[] {
  if (raw === undefined || raw === null) return []

  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []
    const fromJson = tryParseJsonStringArray(trimmed)
    if (fromJson !== null) return fromJson
    return [trimmed]
  }

  if (typeof raw === "number" || typeof raw === "boolean") {
    const s = String(raw).trim()
    return s ? [s] : []
  }

  return []
}

export function formatFavoriteSongForDisplay(value: unknown): string {
  return extractSongsFromValue(value).join(", ")
}

export function hasNonEmptyFavoriteSong(value: unknown): boolean {
  return extractSongsFromValue(value).length > 0
}

export function eventHasSongResponses(
  rsvps: { favorite_song?: unknown }[],
): boolean {
  return rsvps.some((rsvp) => hasNonEmptyFavoriteSong(rsvp.favorite_song))
}

/** Omite valores que son solo dígitos (suelen ser ids o datos corruptos, no títulos). */
function isLikelySongTitle(song: string): boolean {
  return song.length > 0 && !/^\d+$/.test(song)
}

export function buildSongExportRows(
  rsvps: { favorite_song?: unknown }[],
): { cancion: string }[] {
  const songs: string[] = []

  for (const rsvp of rsvps) {
    for (const song of extractSongsFromValue(rsvp.favorite_song)) {
      if (isLikelySongTitle(song)) {
        songs.push(song)
      }
    }
  }

  return [...new Set(songs)]
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
    .map((cancion) => ({ cancion }))
}

function escapeCSV(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function downloadSongsCsv(
  rsvps: { favorite_song?: unknown }[],
  tableName: string,
): void {
  const rows = buildSongExportRows(rsvps)
  if (rows.length === 0) return

  const csvRows = [
    escapeCSV("Canción"),
    ...rows.map((row) => escapeCSV(row.cancion)),
  ]

  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const date = new Date().toISOString().split("T")[0]
  const safeTable = (tableName ?? "").replace(/[^a-zA-Z0-9_-]/g, "_") || "evento"
  link.href = url
  link.setAttribute("download", `canciones-${safeTable}-${date}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
