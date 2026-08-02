import { NextResponse } from "next/server"
import { requireAuthWithTable } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function POST(request: Request) {
  try {
    const { username } = await requireAuthWithTable()

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Error de configuración del servidor" }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó imagen" }, { status: 400 })
    }

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Usá JPG, PNG o WebP." },
        { status: 400 }
      )
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "La imagen no puede superar los 10 MB." }, { status: 400 })
    }

    const path = `${username}/plan.${ext}`
    const buffer = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from("floor-plans")
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return NextResponse.json({ error: "Error al subir la imagen al servidor" }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("floor-plans").getPublicUrl(path)

    // Cache-bust so the browser always shows the latest version after re-upload
    const imageUrl = `${publicUrl}?t=${Date.now()}`

    return NextResponse.json({ ok: true, imageUrl })
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    console.error("Error in floor-plan upload:", error)
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 })
  }
}
