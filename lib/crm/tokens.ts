import { createHash, randomBytes } from "node:crypto"

export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url")
  return {
    token,
    hash: hashInvitationToken(token),
    last4: token.slice(-4),
  }
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function stableHash(value: unknown) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`
}

