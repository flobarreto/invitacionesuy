import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { username, tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    // Obtener el event_name de la tabla admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("admin")
      .select("event_name")
      .eq("username", username)
      .single()

    const eventName = adminData?.event_name || null

    // Usar el table_name de la tabla admin, o el username como fallback
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching RSVPs:", error)
      return NextResponse.json(
        { error: "Error al obtener los RSVPs" },
        { status: 500 }
      )
    }

    return NextResponse.json({ rsvps: data || [], username, tableName, eventName })
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }
    console.error("Error in RSVPs route:", error)
    return NextResponse.json(
      { error: "Error al obtener los RSVPs" },
      { status: 500 }
    )
  }
}
