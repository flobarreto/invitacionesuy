import { requireEventAccess, assertMutationRequest } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { manualGuestSchema } from "@/lib/crm/schemas"
import { createInvitationGroup, listInvitationGroups } from "@/lib/crm/service"

type RouteContext = { params: Promise<{ eventId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { eventId } = await params
    await requireEventAccess(eventId)
    const groups = await listInvitationGroups(eventId)
    return Response.json(
      { groups },
      { headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" } },
    )
  } catch (error) {
    return crmErrorResponse(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { eventId } = await params
    assertMutationRequest(request)
    await requireEventAccess(eventId)
    const json = await request.json().catch(() => null)
    const parsed = manualGuestSchema.safeParse(json)
    if (!parsed.success) {
      return Response.json(
        { error: "Datos inválidos", code: "VALIDATION_ERROR", issues: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const result = await createInvitationGroup({ eventId, ...parsed.data })
    return Response.json(result, { status: result.idempotentReplay ? 200 : 201 })
  } catch (error) {
    return crmErrorResponse(error)
  }
}
