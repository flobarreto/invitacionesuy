import { NextResponse } from "next/server"
import { AuthError, RequestSecurityError } from "@/lib/auth"

export function seatingErrorResponse(error: unknown, fallback: string) {
  if (error instanceof RequestSecurityError) {
    return NextResponse.json(
      { error: "Solicitud inválida", code: error.code },
      { status: error.status },
    )
  }

  if (error instanceof AuthError) {
    const publicMessage =
      error.status === 401
        ? "No autorizado"
        : error.status === 403
          ? "Sin acceso al evento"
          : error.status === 404
            ? "Evento no encontrado"
            : "El servicio no está disponible"
    return NextResponse.json(
      { error: publicMessage, code: error.code },
      { status: error.status },
    )
  }

  console.error("Unexpected seating API error", {
    kind: error instanceof Error ? error.name : typeof error,
  })
  return NextResponse.json({ error: fallback }, { status: 500 })
}
