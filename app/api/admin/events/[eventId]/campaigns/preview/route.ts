import { requireEventAccess, assertMutationRequest } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { campaignPreviewSchema } from "@/lib/crm/schemas"
import { previewCampaign } from "@/lib/whatsapp/campaigns"

type RouteContext = { params: Promise<{ eventId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { eventId } = await params
    assertMutationRequest(request)
    await requireEventAccess(eventId)
    const parsed = campaignPreviewSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return Response.json(
        { error: "Campaña inválida", code: "VALIDATION_ERROR", issues: parsed.error.flatten() },
        { status: 400 },
      )
    }
    return Response.json(await previewCampaign({ eventId, ...parsed.data }))
  } catch (error) {
    return crmErrorResponse(error)
  }
}

