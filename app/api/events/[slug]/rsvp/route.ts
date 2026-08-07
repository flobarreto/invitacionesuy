import { assertMutationRequest } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { publicRsvpSchema } from "@/lib/crm/schemas"
import { getPublicInvitationGroup, submitPublicRsvp } from "@/lib/crm/service"
import { enforcePublicRsvpRateLimit } from "@/lib/crm/rate-limit-policies"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params
    const eventSlug = await enforcePublicRsvpRateLimit({
      request,
      slug,
      operation: "read",
    })
    const token = new URL(request.url).searchParams.get("token") ?? ""
    if (token.length < 32 || token.length > 256) {
      return Response.json({ error: "Invitación no encontrada" }, { status: 404 })
    }
    const result = await getPublicInvitationGroup(eventSlug, token)
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
    })
  } catch (error) {
    return crmErrorResponse(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params
    assertMutationRequest(request)
    const eventSlug = await enforcePublicRsvpRateLimit({
      request,
      slug,
      operation: "write",
    })
    const parsed = publicRsvpSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return Response.json(
        { error: "Respuesta inválida", code: "VALIDATION_ERROR", issues: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const result = await submitPublicRsvp(
      eventSlug,
      parsed.data.token,
      parsed.data.responses,
    )
    return Response.json({ ok: true, result })
  } catch (error) {
    return crmErrorResponse(error)
  }
}
