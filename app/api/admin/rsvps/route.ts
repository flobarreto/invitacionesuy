import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { normalizeRsvpTags } from "@/lib/normalizeRsvp"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { username, tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 },
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

    if (rsvpsResult.error) {
      console.error("Error fetching RSVPs:", rsvpsResult.error)
      return NextResponse.json(
        { error: "Error al obtener los RSVPs" },
        { status: 500 },
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
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    console.error("Error in RSVPs route:", error)
    return NextResponse.json(
      { error: "Error al obtener los RSVPs" },
      { status: 500 },
    )
  }
}
