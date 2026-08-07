import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const VERSION = "v1"

export function assertEncryptionSecret(secret: string) {
  if (Buffer.byteLength(secret.trim(), "utf8") < 32) {
    throw new Error("INVITIA_ENCRYPTION_KEY must contain at least 32 bytes")
  }
}

function keyFromSecret(secret: string) {
  assertEncryptionSecret(secret)
  return createHash("sha256").update(secret, "utf8").digest()
}

export function encryptSecret(value: string, secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv)
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".")
}

export function decryptSecret(value: string, secret: string) {
  const [version, iv, tag, ciphertext] = value.split(".")
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted value")
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFromSecret(secret),
    Buffer.from(iv, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
