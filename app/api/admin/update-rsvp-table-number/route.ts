import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"

export async function PUT(request: Request) {
  try {
    const { tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    let payload: {
      rsvpId?: string
      tableNumber?: number | null
    }

    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Formato inválido" },
        { status: 400 }
      )
    }

    const { rsvpId, tableNumber } = payload

    if (!rsvpId) {
      return NextResponse.json(
        { error: "El ID del RSVP es obligatorio" },
        { status: 400 }
      )
    }

    // Actualizar el número de mesa del RSVP
    const { data: updatedData, error } = await supabaseAdmin
      .from(tableName)
      .update({ table_number: tableNumber === null || tableNumber === undefined ? null : Number(tableNumber) })
      .eq("id", rsvpId)
      .select()
      .single()

    if (error) {
      console.error("Error updating RSVP table number:", error)
      return NextResponse.json(
        { error: "Error al actualizar el número de mesa" },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      ok: true, 
      rsvp: updatedData 
    })
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }
    console.error("Error in update-rsvp-table-number route:", error)
    return NextResponse.json(
      { error: "Error al actualizar el número de mesa" },
      { status: 500 }
    )
  }
}
