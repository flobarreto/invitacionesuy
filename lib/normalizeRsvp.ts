/** Normaliza tags de Supabase sin logs ni trabajo extra por fila. */
export function normalizeRsvpTags<T extends Record<string, unknown>>(rsvp: T): T & { tags: unknown[] } {
  const tags = rsvp.tags

  if (tags === null || tags === undefined) {
    return { ...rsvp, tags: [] }
  }

  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags) as unknown
      return { ...rsvp, tags: Array.isArray(parsed) ? parsed : [] }
    } catch {
      return { ...rsvp, tags: [] }
    }
  }

  if (Array.isArray(tags)) {
    return { ...rsvp, tags }
  }

  return { ...rsvp, tags: [] }
}
