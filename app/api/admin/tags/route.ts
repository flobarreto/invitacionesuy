import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    // Obtener las etiquetas donde table_name coincide con el del usuario
    const { data, error } = await supabaseAdmin
      .from("tags")
      .select("id, name, color")
      .eq("table_name", tableName)
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching tags:", error)
      return NextResponse.json(
        { error: "Error al obtener las etiquetas" },
        { status: 500 }
      )
    }

    return NextResponse.json({ tags: data || [] })
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }
    console.error("Error in tags route:", error)
    return NextResponse.json(
      { error: "Error al obtener las etiquetas" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    let payload: {
      name?: string
      color?: string
    }

    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Formato inválido" },
        { status: 400 }
      )
    }

    const { name, color } = payload

    if (!name || !color) {
      return NextResponse.json(
        { error: "El nombre y el color son obligatorios" },
        { status: 400 }
      )
    }

    const insertData = {
      name: name.trim(),
      color: color.trim(),
      table_name: tableName,
    }

    const { error } = await supabaseAdmin.from("tags").insert(insertData)

    if (error) {
      console.error("Error inserting tag:", error)
      return NextResponse.json(
        { error: "Error al agregar la etiqueta" },
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
    console.error("Error in add-tag route:", error)
    return NextResponse.json(
      { error: "Error al agregar la etiqueta" },
      { status: 500 }
    )
  }
}

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
      id?: string
      name?: string
      color?: string
    }

    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Formato inválido" },
        { status: 400 }
      )
    }

    const { id, name, color } = payload

    console.log("PUT request received:", { id, name, color, tableName })

    if (!id) {
      return NextResponse.json(
        { error: "El ID de la etiqueta es obligatorio" },
        { status: 400 }
      )
    }

    if (!name || !color) {
      return NextResponse.json(
        { error: "El nombre y el color son obligatorios" },
        { status: 400 }
      )
    }

    // Primero verificar que la etiqueta existe y pertenece al usuario
    const { data: existingTag, error: fetchError } = await supabaseAdmin
      .from("tags")
      .select("id, table_name")
      .eq("id", id)
      .eq("table_name", tableName)
      .maybeSingle()

    console.log("Existing tag check:", { existingTag, fetchError })

    if (fetchError) {
      console.error("Error fetching tag:", fetchError)
      return NextResponse.json(
        { error: "Error al verificar la etiqueta" },
        { status: 500 }
      )
    }

    if (!existingTag) {
      return NextResponse.json(
        { error: "Etiqueta no encontrada o no tienes permisos para editarla" },
        { status: 404 }
      )
    }

    const updateData = {
      name: name.trim(),
      color: color.trim(),
    }

    // Actualizar la etiqueta
    const { data, error } = await supabaseAdmin
      .from("tags")
      .update(updateData)
      .eq("id", id)
      .eq("table_name", tableName)
      .select()

    console.log("Update result:", { data, error })

    if (error) {
      console.error("Error updating tag:", error)
      console.error("Tag ID:", id)
      console.error("Table name:", tableName)
      return NextResponse.json(
        { error: "Error al actualizar la etiqueta" },
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
    console.error("Error in update-tag route:", error)
    return NextResponse.json(
      { error: "Error al actualizar la etiqueta" },
      { status: 500 }
    )
  }
}
