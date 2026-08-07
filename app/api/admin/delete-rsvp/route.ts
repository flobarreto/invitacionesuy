import { NextResponse } from "next/server"
import { assertMutationRequest, requireAuthWithTable } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { logLegacyDatabaseError, parseLegacyJson } from "@/lib/legacy-admin-api"
import { legacyRsvpDeleteSchema } from "@/lib/legacy-rsvp-delete"
import { supabaseAdmin } from "@/lib/supabase"

export async function DELETE(request: Request) {
  try {
    assertMutationRequest(request)
    const { tableName } = await requireAuthWithTable("write")

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    const parsed = await parseLegacyJson(request, legacyRsvpDeleteSchema)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }

    const { error } = await supabaseAdmin
      .from(tableName)
      .delete()
      .eq("id", parsed.data.id)

    if (error) {
      logLegacyDatabaseError("delete_rsvp", error)
      return NextResponse.json(
        { error: "Error al eliminar el invitado" },
        { status: 503 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return crmErrorResponse(error)
  }
}
