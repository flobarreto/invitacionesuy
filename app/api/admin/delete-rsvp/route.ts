import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"

export async function DELETE(request: Request) {
  try {
    const { username, tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    let payload: {
      id?: string
    }

    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Formato inválido" },
        { status: 400 }
      )
    }

    const { id } = payload

    if (!id) {
      return NextResponse.json(
        { error: "El ID del invitado es obligatorio" },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from(tableName)
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting RSVP:", error)
      return NextResponse.json(
        { error: "Error al eliminar el invitado" },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }
    console.error("Error in delete-rsvp route:", error)
    return NextResponse.json(
      { error: "Error al eliminar el invitado" },
      { status: 500 }
    )
  }
}
