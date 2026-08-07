import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { logLegacyDatabaseError } from "@/lib/legacy-admin-api"
import { normalizeRsvpTags } from "@/lib/normalizeRsvp"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { username, tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "El servicio no está disponible" },
        { status: 503 },
      )
    }

    const [adminResult, rsvpsResult] = await Promise.all([
      supabaseAdmin
        .from("admin")
        .select("event_name")
        .eq("username", username)
        .single(),
      supabaseAdmin
        .from(tableName)
        .select("*")
        .order("created_at", { ascending: false }),
    ])

    if (adminResult.error || rsvpsResult.error) {
      logLegacyDatabaseError(
        adminResult.error ? "load_admin_event_name" : "list_legacy_rsvps",
        adminResult.error ?? rsvpsResult.error,
      )
      return NextResponse.json(
        { error: "Error al obtener los RSVPs" },
        { status: 503 },
      )
    }

    const eventName = adminResult.data?.event_name ?? null
    const rsvpsWithTags = (rsvpsResult.data ?? []).map((rsvp) =>
      normalizeRsvpTags(rsvp as Record<string, unknown>),
    )

    return NextResponse.json(
      { rsvps: rsvpsWithTags, username, tableName, eventName },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      },
    )
  } catch (error: unknown) {
    return crmErrorResponse(error)
  }
}
