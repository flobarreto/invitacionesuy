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
      tagIds?: string[]
    }

    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Formato inválido" },
        { status: 400 }
      )
    }

    const { rsvpId, tagIds } = payload

    if (!rsvpId) {
      return NextResponse.json(
        { error: "El ID del RSVP es obligatorio" },
        { status: 400 }
      )
    }

    if (!Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: "tagIds debe ser un array" },
        { status: 400 }
      )
    }

    // Intentar actualizar como array primero (para campos text[] en PostgreSQL)
    // Si falla, intentaremos como JSON string
    let updatePayload: any = { tags: tagIds }
    
    // Actualizar las etiquetas del RSVP
    let { data: updatedData, error } = await supabaseAdmin
      .from(tableName)
      .update(updatePayload)
      .eq("id", rsvpId)
      .select()
      .single()

    // Si falla con array, intentar como JSON string (para campos jsonb o text)
    if (error && (error.message?.includes('column') || error.code === 'PGRST116')) {
      console.log("Retrying with JSON string format for tags field")
      updatePayload = { tags: JSON.stringify(tagIds) }
      const retryResult = await supabaseAdmin
        .from(tableName)
        .update(updatePayload)
        .eq("id", rsvpId)
        .select()
        .single()
      
      if (retryResult.error) {
        error = retryResult.error
      } else {
        updatedData = retryResult.data
        error = null
      }
    }

    if (error) {
      console.error("Error updating RSVP tags:", error)
      console.error("Table name:", tableName)
      console.error("RSVP ID:", rsvpId)
      console.error("Tag IDs:", tagIds)
      return NextResponse.json(
        { error: "Error al actualizar las etiquetas", details: error.message },
        { status: 500 }
      )
    }

    // Normalizar tags en la respuesta
    let normalizedTags: string[] = []
    if (updatedData?.tags) {
      if (Array.isArray(updatedData.tags)) {
        normalizedTags = updatedData.tags
      } else if (typeof updatedData.tags === 'string') {
        try {
          const parsed = JSON.parse(updatedData.tags)
          normalizedTags = Array.isArray(parsed) ? parsed : []
        } catch {
          normalizedTags = []
        }
      }
    }

    return NextResponse.json({ 
      ok: true, 
      rsvp: { ...updatedData, tags: normalizedTags } 
    })
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }
    console.error("Error in update-rsvp-tags route:", error)
    return NextResponse.json(
      { error: "Error al actualizar las etiquetas" },
      { status: 500 }
    )
  }
}
