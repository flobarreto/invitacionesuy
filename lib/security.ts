const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export class RequestSecurityError extends Error {
  readonly status = 403
  readonly code = "INVALID_REQUEST_ORIGIN"

  constructor(message = "Invalid request origin") {
    super(message)
    this.name = "RequestSecurityError"
  }
}

function normalizedOrigin(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed.origin
  } catch {
    return null
  }
}

function configuredOrigins(): string[] {
  const values = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.ADMIN_ALLOWED_ORIGINS?.split(",") ?? []),
  ]

  return values.flatMap((value) => {
    if (!value) return []
    const origin = normalizedOrigin(value.trim())
    return origin ? [origin] : []
  })
}

/**
 * Rejects cross-origin state-changing requests.
 *
 * SameSite cookies are useful defense-in-depth, but the exact Origin check is
 * what makes existing JSON `fetch` calls CSRF-safe without exposing a session
 * secret to client JavaScript. Additional trusted origins can be configured
 * through ADMIN_ALLOWED_ORIGINS (comma separated).
 */
export function assertMutationRequest(request: Request): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return

  const suppliedOrigin = normalizedOrigin(request.headers.get("origin") ?? "")
  if (!suppliedOrigin) throw new RequestSecurityError()

  const requestOrigin = normalizedOrigin(request.url)
  const allowedOrigins = new Set(configuredOrigins())
  if (requestOrigin) allowedOrigins.add(requestOrigin)

  if (!allowedOrigins.has(suppliedOrigin)) {
    throw new RequestSecurityError()
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase()
  if (fetchSite === "cross-site") {
    throw new RequestSecurityError()
  }
}

