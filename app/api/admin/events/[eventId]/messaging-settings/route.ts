import { assertMutationRequest, requireEventAccess } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { messagingSettingsSchema } from "@/lib/crm/schemas"
import { getMessagingSettings, updateMessagingSettings } from "@/lib/whatsapp/settings"

type RouteContext = { params: Promise<{ eventId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { eventId } = await params
    await requireEventAccess(eventId)
    return Response.json(await getMessagingSettings(eventId), {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    return crmErrorResponse(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { eventId } = await params
    assertMutationRequest(request)
    await requireEventAccess(eventId)
    const parsed = messagingSettingsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return Response.json(
        { error: "Configuración inválida", code: "VALIDATION_ERROR", issues: parsed.error.flatten() },
        { status: 400 },
      )
    }
    return Response.json(await updateMessagingSettings(eventId, parsed.data))
  } catch (error) {
    return crmErrorResponse(error)
  }
}

