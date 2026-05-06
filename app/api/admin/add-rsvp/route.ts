import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const { username, tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    let payload: {
      name?: string
      attendance?: string
      dietaryPreferences?: string[]
      favoriteSong?: string
      drink?: string[]
      isSaveTheDate?: boolean
    };

    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Formato inválido" },
        { status: 400 }
      )
    }

    const { name, attendance, dietaryPreferences = [], favoriteSong = "", drink = [], isSaveTheDate = false } = payload

    if (!name || !attendance && !isSaveTheDate) {
      return NextResponse.json(
        { error: "El nombre y la respuesta de asistencia son obligatorios" },
        { status: 400 }
      )
    }

    const insertData: Record<string, any> = {
      name: name.trim(),
      attendance,
      dietary_preferences: dietaryPreferences,
      drink,
    }

    // Solo incluir favorite_song si está presente y no está vacío
    if (favoriteSong && favoriteSong.trim()) {
      insertData.favorite_song = favoriteSong.trim()
    }

    const { error } = await supabaseAdmin.from(tableName).insert(insertData)

    if (error) {
      console.error("Error inserting RSVP:", error)
      return NextResponse.json(
        { error: "Error al agregar el invitado" },
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
    console.error("Error in add-rsvp route:", error)
    return NextResponse.json(
      { error: "Error al agregar el invitado" },
      { status: 500 }
    )
  }
}
