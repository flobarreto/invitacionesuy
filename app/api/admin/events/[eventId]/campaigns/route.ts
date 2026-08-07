import { requireEventAccess, assertMutationRequest } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { createCampaignSchema } from "@/lib/crm/schemas"
import { createCampaign, listCampaigns } from "@/lib/whatsapp/campaigns"
import { enforceRateLimit } from "@/lib/crm/rate-limit"

type RouteContext = { params: Promise<{ eventId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { eventId } = await params
    await requireEventAccess(eventId)
    return Response.json(
      { campaigns: await listCampaigns(eventId) },
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
    const access = await requireEventAccess(eventId)
    await enforceRateLimit({
      request,
      namespace: "campaign_create",
      identifier: access.adminId,
      limit: 10,
      windowSeconds: 60,
    })
    const parsed = createCampaignSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return Response.json(
        { error: "Campaña inválida", code: "VALIDATION_ERROR", issues: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const result = await createCampaign({
      eventId,
      ...parsed.data,
      requestedByAdminId: access.adminId,
    })
    return Response.json(result, { status: result.idempotentReplay ? 200 : 201 })
  } catch (error) {
    return crmErrorResponse(error)
  }
}
