import { createHmac } from "node:crypto"
import { CrmError, unavailable } from "@/lib/crm/errors"
import { supabaseAdmin } from "@/lib/supabase"

function requestAddress(request: Request) {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  )
}

export type RateLimitInput = {
  request: Request
  namespace: string
  limit: number
  windowSeconds: number
  identifier?: string
  /**
   * A bounded, application-controlled partition inside a fixed namespace.
   * It is included only in the HMAC input and is never persisted verbatim.
   */
  scope?: string
}

export async function enforceRateLimit(input: RateLimitInput) {
  if (!supabaseAdmin) throw unavailable("Supabase no configurado")
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.INVITIA_ENCRYPTION_KEY
  if (!secret || Buffer.byteLength(secret.trim(), "utf8") < 32) {
    throw unavailable("RATE_LIMIT_SECRET no configurado o inseguro")
  }
  const identifier = input.identifier ?? requestAddress(input.request)
  const scopedIdentifier = input.scope
    ? `${input.scope}:${identifier}`
    : identifier
  const keyHash = createHmac("sha256", secret)
    .update(`${input.namespace}:${scopedIdentifier}`, "utf8")
    .digest("hex")
  const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
    p_namespace: input.namespace,
    p_key_hash: keyHash,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  })
  if (error) throw unavailable(error.message)
  const result = data as { allowed: boolean; retry_after_seconds: number }
  if (!result.allowed) {
    throw new CrmError(
      "Demasiados intentos. Probá nuevamente más tarde.",
      "RATE_LIMITED",
      429,
      { retryAfterSeconds: result.retry_after_seconds },
    )
  }
  return result
}
