import { NextResponse } from "next/server"
import { assertMutationRequest, requireEventAccess } from "@/lib/auth"
import { assignGuestSchema } from "@/lib/seating/schemas"
import { seatingErrorResponse } from "@/lib/seating/errors"
import { supabaseAdmin } from "@/lib/supabase"

type Context = { params: Promise<{ eventId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { eventId } = await params
    await assertMutationRequest(request)
    await requireEventAccess(eventId)

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase no está configurado" }, { status: 503 })
    }

    const parsed = assignGuestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Asignación inválida" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc("assign_guest_to_table", {
      p_event_id: eventId,
      p_guest_id: parsed.data.guestId,
      p_table_id: parsed.data.tableId,
      p_force: parsed.data.force,
    })

    if (error) {
      if (error.message.includes("table_capacity_exceeded")) {
        return NextResponse.json(
          { error: "La mesa está completa", code: "TABLE_CAPACITY_EXCEEDED" },
          { status: 409 },
        )
      }
      if (error.message.includes("guest_not_eligible")) {
        return NextResponse.json({ error: "El invitado rechazó la invitación" }, { status: 409 })
      }
      if (error.message.includes("not_found")) {
        return NextResponse.json({ error: "Invitado o mesa no encontrados" }, { status: 404 })
      }
      console.error("Unable to assign guest", { eventId, code: error.code })
      return NextResponse.json({ error: "No se pudo actualizar la mesa" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, assignment: data })
  } catch (error) {
    return seatingErrorResponse(error, "No se pudo actualizar la mesa")
  }
}
