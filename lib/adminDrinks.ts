/** Algunas columnas (p. ej. drink en Postgres/JSON) llegan como string '["a","b"]'. */
export function tryParseJsonStringArray(s: string): string[] | null {
  const t = s.trim()
  if (!t.startsWith("[") || !t.endsWith("]")) return null
  try {
    const parsed = JSON.parse(t) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
  } catch {
    return null
  }
}

export function parseDrinksFromValue(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? "").trim()).filter(Boolean)
  }
  if (typeof raw === "string") {
    const parsed = tryParseJsonStringArray(raw)
    return parsed ?? (raw.trim() ? [raw.trim()] : [])
  }
  return []
}

export function computeDrinkCounts(
  rsvps: { drink?: unknown }[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const rsvp of rsvps) {
    for (const d of parseDrinksFromValue(rsvp.drink)) {
      counts[d] = (counts[d] ?? 0) + 1
    }
  }
  return counts
}

export function formatDrinksForDisplay(raw: unknown): string {
  const drinks = parseDrinksFromValue(raw)
  return drinks.join(", ")
}
