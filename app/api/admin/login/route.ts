import { NextResponse } from "next/server"
import { z } from "zod"
import {
  assertMutationRequest,
  AuthError,
  RequestSecurityError,
  setUserSession,
  verifyCredentials,
} from "@/lib/auth"
import { CrmError } from "@/lib/crm/errors"
import { enforceAdminLoginRateLimits } from "@/lib/crm/rate-limit-policies"

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(256),
}).strict()

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
}

export async function POST(request: Request) {
  try {
    assertMutationRequest(request)
    const parsed = loginSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Usuario y contraseña inválidos" },
        { status: 400 }
      )
    }

    const { username, password } = parsed.data

    await enforceAdminLoginRateLimits(request, username)

    const isValid = await verifyCredentials(username, password)

    if (!isValid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      )
    }

    const session = await setUserSession(username, {
      userAgent: request.headers.get("user-agent"),
      ipAddress: requestIp(request),
    })

    return NextResponse.json(
      { success: true, username: session.username },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    if (error instanceof CrmError) {
      const retryAfter = (
        error.details as { retryAfterSeconds?: number } | undefined
      )?.retryAfterSeconds
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status: error.status,
          headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
        },
      )
    }
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 403 })
    }
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          error: error.status === 401
            ? "Credenciales inválidas"
            : "El servicio de autenticación no está disponible",
        },
        { status: error.status },
      )
    }
    console.error("Unexpected login error", {
      kind: error instanceof Error ? error.name : typeof error,
    })
    return NextResponse.json(
      { error: "Error al iniciar sesión" },
      { status: 500 }
    )
  }
}
