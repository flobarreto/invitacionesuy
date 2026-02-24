import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"

/** GET: devuelve el layout del plano de mesas del admin actual (por table_name) */
export async function GET() {
  try {
    const { tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("floor_plan")
      .select("layout, updated_at")
      .eq("table_name", tableName)
      .maybeSingle()

    if (error) {
      console.error("Error fetching floor plan:", error)
      // Si la tabla no existe (42P01) o no hay permisos, devolver null en vez de 500
      const code = (error as { code?: string }).code
      const msg = (error as { message?: string }).message ?? ""
      if (code === "42P01" || code === "PGRST204" || msg.includes("does not exist")) {
        return NextResponse.json({ layout: null })
      }
      return NextResponse.json(
        { error: "Error al obtener el plano", detail: msg || String(error) },
        { status: 500 }
      )
    }

    if (!data?.layout) {
      return NextResponse.json({ layout: null })
    }

    const layout = data.layout as Record<string, unknown>
    if (!layout.venueId) {
      layout.venueId = tableName
    }
    return NextResponse.json({ layout })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    console.error("Error in GET floor-plan:", err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "Error al cargar el plano", detail: message },
      { status: 500 }
    )
  }
}

/** PUT: guarda el layout del plano de mesas del admin actual */
export async function PUT(request: Request) {
  try {
    const { tableName } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { venueId, width, height, background, tables } = body

    if (typeof width !== "number" || typeof height !== "number" || !Array.isArray(tables)) {
      return NextResponse.json(
        { error: "Datos del plano inválidos" },
        { status: 400 }
      )
    }

    const layout = {
      venueId: typeof venueId === "string" ? venueId : tableName,
      width: Number(width),
      height: Number(height),
      background: background ?? null,
      tables: tables ?? [],
    }

    const { error } = await supabaseAdmin
      .from("floor_plan")
      .upsert(
        {
          table_name: tableName,
          layout,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "table_name" }
      )

    if (error) {
      console.error("Error saving floor plan:", error)
      const code = (error as { code?: string }).code
      const msg = (error as { message?: string }).message ?? ""
      if (code === "42P01" || msg.includes("does not exist")) {
        return NextResponse.json(
          { error: "La tabla floor_plan no existe en Supabase. Ejecutá el SQL de creación en el SQL Editor." },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: "Error al guardar el plano", detail: msg || String(error) },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, layout })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    console.error("Error in PUT floor-plan:", err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "Error al guardar el plano", detail: message },
      { status: 500 }
    )
  }
}
