import { NextResponse } from "next/server"
import { assertMutationRequest, requireAuthWithTable } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { enforceRateLimit } from "@/lib/crm/rate-limit"
import {
  legacyRsvpTableSchema,
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
    const parsed = await parseLegacyJson(request, legacyRsvpTableSchema)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { rsvpId, tableNumber } = parsed.data

    // Normalizar el número de mesa (case-insensitive, guardando en mayúsculas)
    const normalizedTableNumber =
      typeof tableNumber === "string"
        ? tableNumber.trim().toUpperCase()
        : null

    // Actualizar el número de mesa del RSVP
    const { data: updatedData, error } = await supabaseAdmin
      .from(tableName)
      .update({
        table_number: normalizedTableNumber && normalizedTableNumber.length > 0 ? normalizedTableNumber : null,
      })
      .eq("id", rsvpId)
      .select("id,table_number")
      .single()

    if (error) {
      logLegacyDatabaseError("update_rsvp_table", error)
      return NextResponse.json(
        { error: "Error al actualizar el número de mesa" },
        { status: error.code === "PGRST116" ? 404 : 503 },
      )
    }

    return NextResponse.json({ 
      ok: true, 
      rsvp: updatedData 
    })
  } catch (error: unknown) {
    return crmErrorResponse(error)
  }
}
