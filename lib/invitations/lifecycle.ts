import type {
  InvitationDefinition,
  InvitationRsvpConfig,
  RsvpLifecycleStatus,
} from "./types"

type LifecycleInput = Pick<InvitationDefinition, "event" | "rsvp"> | {
  event: { startsAt: string | null }
  rsvp: InvitationRsvpConfig
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Pure lifecycle calculation. Passing `now` makes it deterministic in tests. */
export function getRsvpLifecycleStatus(
  definition: LifecycleInput,
  now: Date | number = Date.now(),
): RsvpLifecycleStatus {
  if (!definition.rsvp.enabled) return "closed"

  const nowMs = typeof now === "number" ? now : now.getTime()
  const opensAt = timestamp(definition.rsvp.opensAt)
  const closesAt = timestamp(definition.rsvp.closesAt)
  const startsAt = timestamp(definition.event.startsAt)

  // Invalid or incomplete published configuration fails closed.
  if (closesAt === null && startsAt === null) return "closed"
  if (definition.rsvp.status === "closed") return "closed"
  if (startsAt !== null && nowMs >= startsAt) return "closed"
  if (opensAt !== null && nowMs < opensAt) return "scheduled"
  if (definition.rsvp.status === "scheduled" && opensAt === null) return "scheduled"
  if (closesAt !== null && nowMs >= closesAt) return "closed"
  return "open"
}

export function getRsvpLifecycleMessage(
  status: RsvpLifecycleStatus,
): string {
  if (status === "scheduled") {
    return "La confirmación de asistencia todavía no está habilitada."
  }
  if (status === "closed") {
    return "El período de confirmación de asistencia finalizó."
  }
  return "La confirmación de asistencia está habilitada."
}
