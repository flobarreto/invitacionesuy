import { NextResponse } from "next/server"
import {
  getLegacyAdminTransitionPayload,
  requireAuthWithTable,
} from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { eventHasSongResponses } from "@/lib/adminSongs"
import { logLegacyDatabaseError } from "@/lib/legacy-admin-api"
import { supabaseAdmin } from "@/lib/supabase"

/** Datos livianos para el sidebar (sin traer todos los RSVPs). */
export async function GET() {
  try {
    const { username, tableName, eventId } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "El servicio no está disponible" },
        { status: 503 },
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

    if (adminResult.error || songsResult.error) {
      logLegacyDatabaseError(
        adminResult.error ? "load_admin_meta" : "load_rsvp_meta",
        adminResult.error ?? songsResult.error,
      )
      return NextResponse.json(
        { error: "Error al obtener metadatos" },
        { status: 503 },
      )
    }

    const hasSongs = eventHasSongResponses(songsResult.data ?? [])

    return NextResponse.json({
      tableName,
      eventId,
      eventName: adminResult.data?.event_name ?? null,
      hasSongs,
    })
  } catch (error: unknown) {
    const transition = getLegacyAdminTransitionPayload(error)
    if (transition?.code === "LEGACY_CUTOVER_COMPLETE") {
      if (!supabaseAdmin) {
        return NextResponse.json(
          { error: "El servicio no está disponible" },
          { status: 503 },
        )
      }
      const [eventResult, songsResult] = await Promise.all([
        supabaseAdmin
          .from("events")
          .select("display_name")
          .eq("id", transition.eventId)
          .maybeSingle(),
        supabaseAdmin
          .from("guests")
          .select("favorite_song")
          .eq("event_id", transition.eventId)
          .not("favorite_song", "is", null),
      ])
      if (eventResult.error || !eventResult.data || songsResult.error) {
        logLegacyDatabaseError(
          eventResult.error || !eventResult.data
            ? "load_canonical_event_meta"
            : "load_canonical_song_meta",
          eventResult.error ?? songsResult.error,
        )
        return NextResponse.json(
          { error: "Error al obtener metadatos" },
          { status: 503 },
        )
      }
      return NextResponse.json({
        eventId: transition.eventId,
        eventName: eventResult.data.display_name,
        hasSongs: eventHasSongResponses(songsResult.data ?? []),
        legacyCutover: true,
        canonicalAdminUrl: transition.redirectTo,
      })
    }
    return crmErrorResponse(error)
  }
}
