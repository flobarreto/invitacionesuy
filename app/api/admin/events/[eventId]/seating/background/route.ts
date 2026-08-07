import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { assertMutationRequest, requireEventAccess } from "@/lib/auth"
import {
  buildFloorPlanBackgroundPath,
  type FloorPlanBackgroundExtension,
} from "@/lib/seating/background-path"
import { seatingErrorResponse } from "@/lib/seating/errors"
import { supabaseAdmin } from "@/lib/supabase"

const TYPES: Record<string, FloorPlanBackgroundExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

function detectedImageType(bytes: Uint8Array): keyof typeof TYPES | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png"
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp"
  return null
}

type Context = { params: Promise<{ eventId: string }> }

export async function POST(request: Request, { params }: Context) {
  try {
    const { eventId } = await params
    await assertMutationRequest(request)
    await requireEventAccess(eventId)
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase no está configurado" }, { status: 503 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta la imagen" }, { status: 400 })
    }
    if (!TYPES[file.type]) {
      return NextResponse.json({ error: "Usá una imagen JPG, PNG o WebP" }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "La imagen no puede superar 10 MB" }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const detectedType = detectedImageType(bytes)
    if (!detectedType || detectedType !== file.type) {
      return NextResponse.json(
        { error: "El contenido del archivo no coincide con una imagen válida" },
        { status: 400 },
      )
    }
    const extension = TYPES[detectedType]
    const storagePath = buildFloorPlanBackgroundPath(eventId, randomUUID(), extension)
    const uploaded = await supabaseAdmin.storage.from("floor-plans").upload(storagePath, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    })
    if (uploaded.error) {
      console.error("Unable to upload floor plan", { eventId, code: uploaded.error.name })
      return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 500 })
    }

    const signed = await supabaseAdmin.storage.from("floor-plans").createSignedUrl(storagePath, 60 * 60)
    return NextResponse.json({ ok: true, backgroundPath: storagePath, backgroundUrl: signed.data?.signedUrl ?? null })
  } catch (error) {
    return seatingErrorResponse(error, "No se pudo subir la imagen")
  }
}
