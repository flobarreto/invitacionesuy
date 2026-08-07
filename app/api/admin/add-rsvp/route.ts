import { NextResponse } from "next/server"
import { assertMutationRequest, requireAuthWithTable } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { enforceRateLimit } from "@/lib/crm/rate-limit"
import { stableHash } from "@/lib/crm/tokens"
import {
  legacyAddRsvpSchema,
  logLegacyDatabaseError,
  parseLegacyJson,
} from "@/lib/legacy-admin-api"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: Request) {
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
      namespace: "legacy_admin_add_rsvp",
      scope: eventId,
      identifier: adminId,
      limit: 30,
      windowSeconds: 60,
    })
    const parsed = await parseLegacyJson(request, legacyAddRsvpSchema)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? ""
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      return NextResponse.json(
        { error: "Falta una clave de idempotencia válida" },
        { status: 400 },
      )
    }
    const { name, attendance, dietaryPreferences, favoriteSong, drink, isSaveTheDate } = parsed.data

    const insertData: Record<string, unknown> = {
      name,
      attendance: attendance || (isSaveTheDate ? "save_the_date" : ""),
      dietary_preferences: dietaryPreferences,
      drink,
    }

    // Solo incluir favorite_song si está presente y no está vacío
    if (favoriteSong) {
      insertData.favorite_song = favoriteSong
    }

    const { data, error } = await supabaseAdmin.rpc("submit_legacy_rsvp_idempotent", {
      p_event_id: eventId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: stableHash({ eventId, payload: insertData }),
      p_payload: insertData,
    })

    if (error) {
      logLegacyDatabaseError("add_rsvp", error)
      if (error.message.includes("idempotency_key_reused")) {
        return NextResponse.json(
          { error: "La clave de idempotencia ya fue usada con otros datos" },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: "Error al agregar el invitado" },
        { status: 503 },
      )
    }

    return NextResponse.json({
      ok: true,
      idempotentReplay: Boolean(
        (data as { idempotentReplay?: boolean } | null)?.idempotentReplay,
      ),
    })
  } catch (error: unknown) {
    return crmErrorResponse(error)
  }
}
