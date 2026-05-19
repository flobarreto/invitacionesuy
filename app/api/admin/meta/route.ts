import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { eventHasSongResponses } from "@/lib/adminSongs"
import { supabaseAdmin } from "@/lib/supabase"

/** Datos livianos para el sidebar (sin traer todos los RSVPs). */
export async function GET() {
  try {
    const { username, tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 },
      )
    }

    const [adminResult, songsResult] = await Promise.all([
      supabaseAdmin
        .from("admin")
        .select("event_name")
        .eq("username", username)
        .single(),
      supabaseAdmin.from(tableName).select("favorite_song"),
    ])

    if (songsResult.error) {
      console.error("Error fetching meta:", songsResult.error)
      return NextResponse.json(
        { error: "Error al obtener metadatos" },
        { status: 500 },
      )
    }

    const hasSongs = eventHasSongResponses(songsResult.data ?? [])

    return NextResponse.json({
      tableName,
      eventName: adminResult.data?.event_name ?? null,
      hasSongs,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    console.error("Error in admin meta route:", error)
    return NextResponse.json(
      { error: "Error al obtener metadatos" },
      { status: 500 },
    )
  }
}
