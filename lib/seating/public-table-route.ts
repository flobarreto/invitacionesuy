import { CrmError, crmErrorResponse } from "@/lib/crm/errors"
import {
  enforceRateLimit,
  type RateLimitInput,
} from "@/lib/crm/rate-limit"
import { getInvitationDefinition } from "@/lib/invitations/registry"
import {
  invitationTokenFromAuthorization,
  type PublicTableAssignment,
} from "@/lib/seating/public-table-contract"
import { getPublicTableAssignments } from "@/lib/seating/public-table-service"

const PUBLIC_TABLE_LOOKUP_POLICY = {
  namespace: "public_table_lookup",
  limit: 30,
  windowSeconds: 60,
} as const

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  Vary: "Authorization",
} as const

type RateLimitConsumer = (input: RateLimitInput) => Promise<unknown>

export type PublicTableRouteDependencies = {
  consumeRateLimit?: RateLimitConsumer
  lookup?: (
    eventSlug: string,
    token: string,
  ) => Promise<PublicTableAssignment[]>
}

function notFound(): never {
  throw new CrmError(
    "Invitación no encontrada.",
    "INVITATION_NOT_FOUND",
    404,
  )
}

export async function resolvePublicTableEvent(
  request: Request,
  eventLookup: string,
  consume: RateLimitConsumer = enforceRateLimit,
): Promise<string> {
  const definition = getInvitationDefinition(eventLookup)
  if (!definition?.capabilities.tableSearch) notFound()

  await consume({
    request,
    namespace: PUBLIC_TABLE_LOOKUP_POLICY.namespace,
    scope: definition.eventKey,
    limit: PUBLIC_TABLE_LOOKUP_POLICY.limit,
    windowSeconds: PUBLIC_TABLE_LOOKUP_POLICY.windowSeconds,
  })

  return definition.eventKey
}

export async function handlePublicTableLookup(
  request: Request,
  eventLookup: string,
  dependencies: PublicTableRouteDependencies = {},
): Promise<Response> {
  try {
    const token = invitationTokenFromAuthorization(
      request.headers.get("authorization"),
    )
    if (!token) notFound()

    const eventSlug = await resolvePublicTableEvent(
      request,
      eventLookup,
      dependencies.consumeRateLimit,
    )
    const assignments = await (
      dependencies.lookup ?? getPublicTableAssignments
    )(eventSlug, token)

    return Response.json(
      { assignments },
      {
        headers: PRIVATE_RESPONSE_HEADERS,
      },
    )
  } catch (error) {
    const response = crmErrorResponse(error)
    for (const [name, value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) {
      response.headers.set(name, value)
    }
    return response
  }
}
