import { getInvitationDefinition } from "@/lib/invitations/registry"
import { buildInvitationIcs } from "@/lib/invitations/calendar"
import { InvitationRuntimeError, loadRuntimeInvitationDefinition } from "@/lib/invitations/runtime"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params
    const definition = getInvitationDefinition(slug)
    if (!definition) return Response.json({ error: "Invitación no encontrada" }, { status: 404 })
    const runtimeDefinition = await loadRuntimeInvitationDefinition(definition)
    const calendar = buildInvitationIcs(runtimeDefinition)
    if (!calendar) {
      return Response.json({ error: "El evento no tiene una fecha válida" }, { status: 409 })
    }
    return new Response(calendar, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${definition.slug}.ics"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    if (error instanceof InvitationRuntimeError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error("Unexpected calendar error", error)
    return Response.json({ error: "No se pudo generar el calendario" }, { status: 500 })
  }
}
