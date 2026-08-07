import { NextResponse } from "next/server"
import { assertMutationRequest, requireAuthWithTable } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { enforceRateLimit } from "@/lib/crm/rate-limit"
import {
  legacyRsvpTagsSchema,
  logLegacyDatabaseError,
  parseLegacyJson,
} from "@/lib/legacy-admin-api"
import { supabaseAdmin } from "@/lib/supabase"

export async function PUT(request: Request) {
  try {
    assertMutationRequest(request)
    const { adminId, eventId, tableName } = await requireAuthWithTable("write")

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "El servicio no está disponible" },
        { status: 503 },
      )
    }

    await enforceRateLimit({
      request,
      namespace: "legacy_admin_rsvp_update",
      scope: eventId,
      identifier: adminId,
      limit: 120,
      windowSeconds: 60,
    })
    const parsed = await parseLegacyJson(request, legacyRsvpTagsSchema)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { rsvpId, tagIds } = parsed.data

    if (tagIds.length > 0) {
      const { data: ownedTags, error: tagError } = await supabaseAdmin
        .from("tags")
        .select("id,legacy_id")
        .eq("event_id", eventId)
      if (tagError) {
        logLegacyDatabaseError("verify_rsvp_tags", tagError)
        return NextResponse.json(
          { error: "Error al verificar las etiquetas" },
          { status: 503 },
        )
      }
      const ownedTagIds = new Set(
        (ownedTags ?? []).flatMap((tag) =>
          tag.legacy_id ? [tag.id, tag.legacy_id] : [tag.id],
        ),
      )
      if (tagIds.some((tagId) => !ownedTagIds.has(tagId))) {
        return NextResponse.json(
          { error: "Una o más etiquetas no pertenecen al evento" },
          { status: 400 },
        )
      }
    }

    // Intentar actualizar como array primero (para campos text[] en PostgreSQL)
    // Si falla, intentaremos como JSON string
    let updatePayload: { tags: string[] | string } = { tags: tagIds }

    // Actualizar las etiquetas del RSVP
    let { data: updatedData, error } = await supabaseAdmin
      .from(tableName)
      .update(updatePayload)
      .eq("id", rsvpId)
      .select("id,tags")
      .single()

    // Si falla con array, intentar como JSON string (para campos jsonb o text)
    if (error && ["22P02", "42804"].includes(error.code ?? "")) {
      updatePayload = { tags: JSON.stringify(tagIds) }
      const retryResult = await supabaseAdmin
        .from(tableName)
        .update(updatePayload)
        .eq("id", rsvpId)
        .select("id,tags")
        .single()

      if (retryResult.error) {
        error = retryResult.error
      } else {
        updatedData = retryResult.data
        error = null
      }
    }

    if (error) {
      logLegacyDatabaseError("update_rsvp_tags", error)
      return NextResponse.json(
        { error: "Error al actualizar las etiquetas" },
        { status: error.code === "PGRST116" ? 404 : 503 },
      )
    }

    // Normalizar tags en la respuesta
    let normalizedTags: string[] = []
    if (updatedData?.tags) {
      if (Array.isArray(updatedData.tags)) {
        normalizedTags = updatedData.tags
      } else if (typeof updatedData.tags === "string") {
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
  } catch (error: unknown) {
    return crmErrorResponse(error)
  }
}
