import rawDefinitions from "./config.json"
import type { InvitationDefinition } from "./types"

const definitions = rawDefinitions as InvitationDefinition[]

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Accepts canonical slugs, legacy route segments and full invitation URLs.
 * Query strings and hashes are deliberately ignored.
 */
export function normalizeInvitationLookup(value: string): string {
  const decoded = safeDecode(value.trim())
  let pathname = decoded

  try {
    pathname = new URL(decoded).pathname
  } catch {
    pathname = decoded.split(/[?#]/, 1)[0] ?? decoded
  }

  const segments = pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)

  const candidate =
    segments[0]?.toLocaleLowerCase("es") === "invitaciones"
      ? (segments[1] ?? "")
      : (segments.at(-1) ?? "")

  return safeDecode(candidate).toLocaleLowerCase("es")
}

function definitionLookups(definition: InvitationDefinition): string[] {
  return [
    definition.slug,
    ...definition.aliases,
    ...definition.legacy.routes,
  ].map(normalizeInvitationLookup)
}

export function getInvitationDefinitions(options?: {
  includeDrafts?: boolean
}): readonly InvitationDefinition[] {
  if (options?.includeDrafts) return definitions
  return definitions.filter((definition) => definition.status === "published")
}

export function getInvitationDefinition(
  slugOrAlias: string,
  options?: { includeDrafts?: boolean },
): InvitationDefinition | undefined {
  const lookup = normalizeInvitationLookup(slugOrAlias)

  return getInvitationDefinitions(options).find((definition) =>
    definitionLookups(definition).includes(lookup),
  )
}

export function requireInvitationDefinition(
  slugOrAlias: string,
  options?: { includeDrafts?: boolean },
): InvitationDefinition {
  const definition = getInvitationDefinition(slugOrAlias, options)
  if (!definition) {
    throw new Error(`Invitación desconocida: ${slugOrAlias}`)
  }
  return definition
}

export function getInvitationCanonicalPath(
  definition: InvitationDefinition,
): string {
  return `/invitaciones/${definition.slug}`
}

export function getInvitationByLegacyRsvpEvent(
  eventKey: string,
): InvitationDefinition | undefined {
  return getInvitationDefinitions().find(
    (definition) => definition.legacy.rsvpEventKey === eventKey,
  )
}

export function getLegacyRsvpTable(eventKey: string): string | undefined {
  return getInvitationByLegacyRsvpEvent(eventKey)?.legacy.rsvpTable
}

export function getLegacyRsvpEndpoint(slugOrAlias: string): string {
  const definition = requireInvitationDefinition(slugOrAlias)
  return `/api/rsvp/${definition.legacy.rsvpEventKey}`
}
