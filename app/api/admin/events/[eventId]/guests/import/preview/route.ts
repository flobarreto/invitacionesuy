import { requireEventAccess, assertMutationRequest } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { csvPreviewPayloadSchema } from "@/lib/crm/schemas"
import { previewCsvForEvent } from "@/lib/crm/service"
import { enforceRateLimit } from "@/lib/crm/rate-limit"

type RouteContext = { params: Promise<{ eventId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { eventId } = await params
    assertMutationRequest(request)
    const access = await requireEventAccess(eventId)
    await enforceRateLimit({
      request,
      namespace: "crm_csv_preview",
      identifier: access.adminId,
      limit: 30,
      windowSeconds: 60,
    })
    const parsed = csvPreviewPayloadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return Response.json(
        { error: "CSV inválido", code: "VALIDATION_ERROR", issues: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const preview = await previewCsvForEvent(
      eventId,
      parsed.data.csv,
      parsed.data.defaultCallingCode,
    )
    return Response.json(preview)
  } catch (error) {
    return crmErrorResponse(error)
  }
}
