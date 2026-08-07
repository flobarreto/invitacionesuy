import { CrmError } from "@/lib/crm/errors"
import {
  enforceRateLimit,
  type RateLimitInput,
} from "@/lib/crm/rate-limit"
import { getInvitationDefinition } from "@/lib/invitations/registry"

type RateLimitConsumer = (input: RateLimitInput) => Promise<unknown>

export const PUBLIC_RSVP_RATE_LIMITS = {
  read: {
    namespace: "public_rsvp_read",
    limit: 60,
    windowSeconds: 60,
  },
  write: {
    namespace: "public_rsvp_write",
    limit: 12,
    windowSeconds: 60,
  },
} as const

export async function enforceAdminLoginRateLimits(
  request: Request,
  username: string,
  consume: RateLimitConsumer = enforceRateLimit,
) {
  // Keep these sequential. Once an IP is blocked it must not be able to create
  // an unbounded number of username buckets.
  await consume({
    request,
    namespace: "admin_login_ip",
    limit: 10,
    windowSeconds: 15 * 60,
  })
  await consume({
    request,
    namespace: "admin_login_username",
    identifier: username.toLocaleLowerCase("es-UY"),
    limit: 10,
    windowSeconds: 15 * 60,
  })
}

export async function enforcePublicRsvpRateLimit(
  input: {
    request: Request
    slug: string
    operation: keyof typeof PUBLIC_RSVP_RATE_LIMITS
  },
  consume: RateLimitConsumer = enforceRateLimit,
) {
  // Resolve from the finite published registry before touching the database.
  // Arbitrary route segments therefore cannot allocate rate-limit rows.
  const definition = getInvitationDefinition(input.slug)
  if (!definition || !definition.capabilities.rsvp) {
    throw new CrmError(
      "Invitación no encontrada.",
      "INVITATION_NOT_FOUND",
      404,
    )
  }

  const policy = PUBLIC_RSVP_RATE_LIMITS[input.operation]
  await consume({
    request: input.request,
    namespace: policy.namespace,
    scope: definition.eventKey,
    limit: policy.limit,
    windowSeconds: policy.windowSeconds,
  })

  return definition.eventKey
}
