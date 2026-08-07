import { NextResponse } from "next/server"
import {
  assertMutationRequest,
  AuthError,
  clearUserSession,
  RequestSecurityError,
} from "@/lib/auth"

export async function POST(request: Request) {
  try {
    assertMutationRequest(request)
    await clearUserSession()
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 403 })
    }
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: "No se pudo revocar la sesión. Intentá nuevamente." },
        { status: error.status },
      )
    }
    console.error("Unexpected logout error", {
      kind: error instanceof Error ? error.name : typeof error,
    })
    return NextResponse.json(
      { error: "Error al cerrar sesión" },
      { status: 500 }
    )
  }
}
