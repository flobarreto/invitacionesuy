import { NextResponse } from "next/server"
import { assertMutationRequest, requireAuthWithTable } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { enforceRateLimit } from "@/lib/crm/rate-limit"
import {
  legacyTagCreateSchema,
  legacyTagUpdateSchema,
  logLegacyDatabaseError,
  parseLegacyJson,
} from "@/lib/legacy-admin-api"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { eventId } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "El servicio no está disponible" },
        { status: 503 },
      )
    }

    // event_id is the canonical tenant boundary; table_name is legacy metadata.
    const { data, error } = await supabaseAdmin
      .from("tags")
      .select("id, legacy_id, name, color")
      .eq("event_id", eventId)
      .order("name", { ascending: true })

    if (error) {
      logLegacyDatabaseError("list_tags", error)
      return NextResponse.json(
        { error: "Error al obtener las etiquetas" },
        { status: 503 },
      )
    }

    return NextResponse.json({
      tags: (data || []).map((tag) => ({
        id: tag.legacy_id ?? tag.id,
        name: tag.name,
        color: tag.color,
      })),
    })
  } catch (error: unknown) {
    return crmErrorResponse(error)
  }
}

export async function POST(request: Request) {
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
      namespace: "legacy_admin_tags_write",
      scope: eventId,
      identifier: adminId,
      limit: 30,
      windowSeconds: 60,
    })
    const parsed = await parseLegacyJson(request, legacyTagCreateSchema)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { name, color } = parsed.data

    const insertData = {
      event_id: eventId,
      name,
      color: color.toUpperCase(),
      table_name: tableName,
    }

    const { error } = await supabaseAdmin.from("tags").insert(insertData)

    if (error) {
      logLegacyDatabaseError("create_tag", error)
      if (error.code === "23505") {
        const { data: existingTags, error: lookupError } = await supabaseAdmin
          .from("tags")
          .select("id,name,color")
          .eq("event_id", eventId)
        if (lookupError) {
          logLegacyDatabaseError("resolve_duplicate_tag", lookupError)
        }
        const existing = (existingTags ?? []).find(
          (tag) => tag.name.trim().toLocaleLowerCase("es") === name.toLocaleLowerCase("es"),
        )
        if (existing?.color.toUpperCase() === color.toUpperCase()) {
          return NextResponse.json({ ok: true, id: existing.id, idempotentReplay: true })
        }
        return NextResponse.json(
          { error: "Ya existe una etiqueta con ese nombre" },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: "Error al agregar la etiqueta" },
        { status: 503 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return crmErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    assertMutationRequest(request)
    const { adminId, eventId } = await requireAuthWithTable("write")

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "El servicio no está disponible" },
        { status: 503 },
      )
    }

    await enforceRateLimit({
      request,
      namespace: "legacy_admin_tags_write",
      scope: eventId,
      identifier: adminId,
      limit: 30,
      windowSeconds: 60,
    })
    const parsed = await parseLegacyJson(request, legacyTagUpdateSchema)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { id, name, color } = parsed.data

    // Primero verificar que la etiqueta existe y pertenece al usuario
    const { data: eventTags, error: fetchError } = await supabaseAdmin
      .from("tags")
      .select("id,legacy_id")
      .eq("event_id", eventId)

    if (fetchError) {
      logLegacyDatabaseError("verify_tag", fetchError)
      return NextResponse.json(
        { error: "Error al verificar la etiqueta" },
        { status: 503 },
      )
    }

    const existingTag = (eventTags ?? []).find(
      (tag) => tag.id === id || tag.legacy_id === id,
    )
    if (!existingTag) {
      return NextResponse.json(
        { error: "Etiqueta no encontrada o no tienes permisos para editarla" },
        { status: 404 }
      )
    }

    const updateData = {
      name,
      color: color.toUpperCase(),
    }

    // Actualizar la etiqueta
    const { data, error } = await supabaseAdmin
      .from("tags")
      .update(updateData)
      .eq("id", existingTag.id)
      .eq("event_id", eventId)
      .select("id")

    if (error) {
      logLegacyDatabaseError("update_tag", error)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe una etiqueta con ese nombre" },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: "Error al actualizar la etiqueta" },
        { status: 503 },
      )
    }

    return NextResponse.json({ ok: true, id: data?.[0]?.id ?? id })
  } catch (error: unknown) {
    return crmErrorResponse(error)
  }
}
