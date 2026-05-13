import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { username } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Error de configuración del servidor" }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from("floor_plans")
      .select("image_url, opacity, floor_tables")
      .eq("admin_username", username)
      .maybeSingle()

    if (error) {
      console.error("Error fetching floor plan:", error)
      return NextResponse.json({ error: "Error al cargar el plano" }, { status: 500 })
    }

    return NextResponse.json({
      floorPlan: data ?? { image_url: null, opacity: 0.7, floor_tables: [] },
    })
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    console.error("Error in floor-plan GET:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { username } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Error de configuración del servidor" }, { status: 500 })
    }

    let body: { imageUrl?: string | null; opacity?: number; floorTables?: unknown[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 })
    }

    const { imageUrl, opacity, floorTables } = body

    const { error } = await supabaseAdmin.from("floor_plans").upsert(
      {
        admin_username: username,
        image_url: imageUrl ?? null,
        opacity: typeof opacity === "number" ? Math.max(0, Math.min(1, opacity)) : 0.7,
        floor_tables: Array.isArray(floorTables) ? floorTables : [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "admin_username" }
    )

    if (error) {
      console.error("Error saving floor plan:", error)
      return NextResponse.json({ error: "Error al guardar el plano" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    console.error("Error in floor-plan PUT:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
