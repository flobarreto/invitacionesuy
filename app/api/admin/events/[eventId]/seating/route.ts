import { NextResponse } from "next/server"
import { requireEventAccess, assertMutationRequest } from "@/lib/auth"
import { isCanonicalFloorPlanBackgroundPath } from "@/lib/seating/background-path"
import { saveSeatingLayoutSchema } from "@/lib/seating/schemas"
import { seatingErrorResponse } from "@/lib/seating/errors"
import type { SeatingGuest } from "@/lib/seating/types"
import { supabaseAdmin } from "@/lib/supabase"

type Context = { params: Promise<{ eventId: string }> }

function configurationError() {
  return NextResponse.json({ error: "Supabase no está configurado" }, { status: 503 })
}

function normalizeGuest(row: Record<string, unknown>): SeatingGuest {
  const joins = Array.isArray(row.guest_tags) ? row.guest_tags : []
  const tags = joins.flatMap((join) => {
    if (!join || typeof join !== "object") return []
    const tag = (join as { tags?: unknown }).tags
    const value = Array.isArray(tag) ? tag[0] : tag
    if (!value || typeof value !== "object") return []
    const typed = value as { id?: unknown; name?: unknown; color?: unknown }
    if (typeof typed.id !== "string" || typeof typed.name !== "string") return []
    return [{ id: typed.id, name: typed.name, color: typeof typed.color === "string" ? typed.color : "#64748b" }]
  })

  return {
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    attendance_status:
      row.attendance_status === "attending" || row.attendance_status === "declined"
        ? row.attendance_status
        : "pending",
    table_id: typeof row.table_id === "string" ? row.table_id : null,
    tags,
  }
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const { eventId } = await params
    await requireEventAccess(eventId)
    if (!supabaseAdmin) return configurationError()

    const [planResult, tablesResult, guestsResult] = await Promise.all([
      supabaseAdmin
        .from("floor_plans")
        .select("event_id, logical_width, logical_height, background_path, revision")
        .eq("event_id", eventId)
        .maybeSingle(),
      supabaseAdmin
        .from("seating_tables")
        .select("id,event_id,code,label,capacity,shape,x,y,width,height,rotation")
        .eq("event_id", eventId)
        .order("code", { ascending: true }),
      supabaseAdmin
        .from("guests")
        .select("id,name,attendance_status,table_id,guest_tags(tags(id,name,color))")
        .eq("event_id", eventId)
        .order("name", { ascending: true }),
    ])

    const error = planResult.error ?? tablesResult.error ?? guestsResult.error
    if (error) {
      console.error("Unable to load seating plan", { eventId, code: error.code })
      return NextResponse.json({ error: "No se pudo cargar el plano" }, { status: 500 })
    }

    const plan = planResult.data ?? {
      event_id: eventId,
      logical_width: 1200,
      logical_height: 700,
      background_path: null,
      revision: 0,
    }

    let backgroundUrl: string | null = null
    if (plan.background_path) {
      if (!isCanonicalFloorPlanBackgroundPath(eventId, plan.background_path)) {
        console.error("Invalid seating background path", { eventId })
        return NextResponse.json(
          {
            error: "La referencia de la imagen de fondo del plano no es válida",
            code: "INVALID_BACKGROUND_PATH",
          },
          { status: 500 },
        )
      }
      const signed = await supabaseAdmin.storage
        .from("floor-plans")
        .createSignedUrl(plan.background_path, 60 * 60)
      if (signed.error) {
        console.error("Unable to sign seating background", {
          eventId,
          code: signed.error.name,
        })
        return NextResponse.json(
          { error: "No se pudo cargar la imagen de fondo del plano" },
          { status: 503 },
        )
      }
      backgroundUrl = signed.data?.signedUrl ?? null
    }

    return NextResponse.json({
      floorPlan: { ...plan, background_url: backgroundUrl },
      tables: tablesResult.data ?? [],
      guests: (guestsResult.data ?? []).map((row) => normalizeGuest(row as Record<string, unknown>)),
    })
  } catch (error) {
    return seatingErrorResponse(error, "No se pudo cargar el plano")
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const { eventId } = await params
    await assertMutationRequest(request)
    await requireEventAccess(eventId)
    if (!supabaseAdmin) return configurationError()

    const parsed = saveSeatingLayoutSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Plano inválido", issues: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const backgroundPath = parsed.data.floorPlan.backgroundPath
    if (
      backgroundPath !== null &&
      !isCanonicalFloorPlanBackgroundPath(eventId, backgroundPath)
    ) {
      return NextResponse.json(
        { error: "La referencia de la imagen de fondo no es válida para este evento" },
        { status: 400 },
      )
    }

    const { data, error } = await supabaseAdmin.rpc("save_seating_layout", {
      p_event_id: eventId,
      p_expected_revision: parsed.data.expectedRevision,
      p_floor_plan: {
        logical_width: parsed.data.floorPlan.logicalWidth,
        logical_height: parsed.data.floorPlan.logicalHeight,
        background_path: parsed.data.floorPlan.backgroundPath,
      },
      p_tables: parsed.data.tables,
    })

    if (error) {
      if (error.code === "40001" || error.message.includes("revision_conflict")) {
        return NextResponse.json(
          { error: "El plano cambió en otra pestaña. Recargalo antes de continuar." },
          { status: 409 },
        )
      }
      if (error.message.includes("occupied_table_removal")) {
        return NextResponse.json(
          {
            error: "Una mesa eliminada recibió invitados. Recargá el plano y movelos antes de borrarla.",
            code: "OCCUPIED_TABLE_REMOVAL",
          },
          { status: 409 },
        )
      }
      console.error("Unable to save seating plan", { eventId, code: error.code })
      return NextResponse.json({ error: "No se pudo guardar el plano" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, revision: Number(data) })
  } catch (error) {
    return seatingErrorResponse(error, "No se pudo guardar el plano")
  }
}
