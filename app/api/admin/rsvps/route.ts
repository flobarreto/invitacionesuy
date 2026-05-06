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

    // Asegurar que tags sea un array (puede venir como null o string desde la BD)
    const rsvpsWithTags = (data || []).map((rsvp: any) => {
      
      if (rsvp.tags === null || rsvp.tags === undefined) {
        return { ...rsvp, tags: [] }
      }
      
      // Si tags es un string, intentar parsearlo como JSON
      if (typeof rsvp.tags === 'string') {
        try {
          const parsed = JSON.parse(rsvp.tags)
          console.log(`floooo RSVP ${rsvp.id} - parsed:`, parsed)
          return { ...rsvp, tags: Array.isArray(parsed) ? parsed : [] }
        } catch (e) {
          console.log(`floooo RSVP ${rsvp.id} - error parseando JSON:`, e)
          return { ...rsvp, tags: [] }
        }
      }
      
      // Si ya es un array, asegurarse de que sea válido
      if (Array.isArray(rsvp.tags)) {
        return { ...rsvp, tags: rsvp.tags }
      }
      
      return { ...rsvp, tags: [] }
    })
    

    return NextResponse.json({ rsvps: rsvpsWithTags, username, tableName, eventName })
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
