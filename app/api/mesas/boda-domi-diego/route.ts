import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

const TABLE = "domi_diego"

const MIN_QUERY_LEN = 4
const MAX_QUERY_LEN = 100
const MAX_RESULTS = 30

function sanitizeIlikeFragment(raw: string): string {
  return raw
    .slice(0, MAX_QUERY_LEN)
    .replace(/[%_\\]/g, "")
    .trim()
}

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Error de configuración del servidor" },
      { status: 500 },
    )
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()

  if (q.length < MIN_QUERY_LEN) {
    return NextResponse.json({
      results: [],
      ready: false,
    })
  }

  const safe = sanitizeIlikeFragment(q)
  if (safe.length < MIN_QUERY_LEN) {
    return NextResponse.json({
      results: [],
      ready: false,
    })
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("id, name, table_number")
    .ilike("name", `%${safe}%`)
    .order("name", { ascending: true })
    .limit(MAX_RESULTS)

  if (error) {
    console.error("mesa lookup boda_domi_diego:", error)
    return NextResponse.json(
      { error: "No pudimos buscar ahora. Probá de nuevo." },
      { status: 500 },
    )
  }

  return NextResponse.json({
    results: data ?? [],
    ready: true,
  })
}
