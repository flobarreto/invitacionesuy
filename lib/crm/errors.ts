import {
  AuthError,
  getLegacyAdminTransitionPayload,
  RequestSecurityError,
} from "@/lib/auth"

export class CrmError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "CrmError"
  }
}

export function unavailable(details?: unknown) {
  return new CrmError(
    "El servicio no está disponible en este momento.",
    "SERVICE_UNAVAILABLE",
    503,
    details,
  )
}

export function crmErrorResponse(error: unknown) {
  const legacyTransition = getLegacyAdminTransitionPayload(error)
  if (legacyTransition) {
    return Response.json(legacyTransition, { status: 409 })
  }

  if (error instanceof RequestSecurityError) {
    return Response.json(
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
    return Response.json(
      { error: publicMessage, code: error.code },
      { status: error.status },
    )
  }

  if (error instanceof CrmError) {
    const detailsArePublic = new Set([
      "INVALID_IMPORT",
      "NO_ELIGIBLE_RECIPIENTS",
      "PREVIEW_CHANGED",
      "RATE_LIMITED",
    ]).has(error.code)
    if (error.status >= 500) {
      console.error("CRM service error", { code: error.code })
    }
    return Response.json(
      {
        error: error.message,
        code: error.code,
        ...(detailsArePublic && error.details !== undefined
          ? { details: error.details }
          : {}),
      },
      { status: error.status },
    )
  }

  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    )
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return Response.json({ error: "No autorizado", code: "UNAUTHORIZED" }, { status: 401 })
    }
    if (error.message === "Forbidden") {
      return Response.json({ error: "Sin acceso al evento", code: "FORBIDDEN" }, { status: 403 })
    }
    if (error.message === "Invalid request origin" || error.message === "CSRF") {
      return Response.json({ error: "Solicitud inválida", code: "INVALID_ORIGIN" }, { status: 403 })
    }
  }

  console.error("Unexpected CRM API error", {
    kind: error instanceof Error ? error.name : typeof error,
  })
  return Response.json({ error: "Error interno", code: "INTERNAL_ERROR" }, { status: 500 })
}
