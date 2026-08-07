import { requireEventAccess, assertMutationRequest } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { csvPayloadSchema } from "@/lib/crm/schemas"
import { importGuestCsv } from "@/lib/crm/service"
import { enforceRateLimit } from "@/lib/crm/rate-limit"

type RouteContext = { params: Promise<{ eventId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { eventId } = await params
    assertMutationRequest(request)
    const access = await requireEventAccess(eventId)
    await enforceRateLimit({
      request,
      namespace: "crm_csv_import",
      identifier: access.adminId,
      limit: 5,
      windowSeconds: 60,
    })
    const parsed = csvPayloadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return Response.json(
        { error: "CSV inválido", code: "VALIDATION_ERROR", issues: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const result = await importGuestCsv(
      eventId,
      parsed.data.csv,
      parsed.data.idempotencyKey,
      parsed.data.defaultCallingCode,
    )
    return Response.json(result, { status: result.idempotentReplay ? 200 : 201 })
  } catch (error) {
    return crmErrorResponse(error)
  }
}
