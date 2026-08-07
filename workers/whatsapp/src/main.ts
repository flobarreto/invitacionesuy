import { randomUUID } from "node:crypto"
import { createServer } from "node:http"
import { createClient } from "@supabase/supabase-js"
import { normalizePhone } from "../../../lib/crm/phone"
import { validateWhatsAppDispatchSafety } from "../../../lib/whatsapp/safety"
import { assertEncryptionSecret } from "../../../lib/whatsapp/crypto"
import { operationalErrorMessage } from "../../../lib/whatsapp/send-outcome"
import { SupabaseAuthStateStore } from "./auth-store"
import { BaileysProvider } from "./baileys-provider"
import { WhatsAppWorkerEngine } from "./engine"
import { EncryptedInboundSpool } from "./inbound-spool"
import { WorkerRepository } from "./repository"

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function numberEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name] ?? fallback)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} is invalid`)
  return parsed
}

const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
})
const encryptionKey = required("INVITIA_ENCRYPTION_KEY")
assertEncryptionSecret(encryptionKey)
const globalEnabled = process.env.WHATSAPP_GLOBAL_ENABLED === "true"
const inboundSpoolDirectory = process.env.WHATSAPP_INBOUND_SPOOL_DIR?.trim()
if (globalEnabled && !inboundSpoolDirectory) {
  throw new Error("WHATSAPP_INBOUND_SPOOL_DIR is required when WhatsApp is enabled")
}
const phoneHashingSecret = process.env.PHONE_HASH_SECRET ?? encryptionKey
if (Buffer.byteLength(phoneHashingSecret.trim(), "utf8") < 32) {
  throw new Error("PHONE_HASH_SECRET must contain at least 32 bytes")
}
const repository = new WorkerRepository(
  supabase,
  encryptionKey,
  phoneHashingSecret,
)
const authStore = new SupabaseAuthStateStore(supabase, encryptionKey)
const inboundSpool = new EncryptedInboundSpool(
  inboundSpoolDirectory ?? "/tmp/invitia-whatsapp-inbound-disabled",
  encryptionKey,
)
const provider = new BaileysProvider(
  authStore,
  (qr) => repository.storePairingQr(qr),
  inboundSpool,
)
const allowAll = process.env.WHATSAPP_ALLOW_ALL === "true"
const rawAllowlist = (process.env.WHATSAPP_ALLOWLIST ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean)
if (allowAll && rawAllowlist.length > 0) {
  throw new Error("WHATSAPP_ALLOW_ALL and WHATSAPP_ALLOWLIST are mutually exclusive")
}
const normalizedAllowlist = rawAllowlist.map((entry) => normalizePhone(entry))
if (normalizedAllowlist.some((entry) => !entry.ok)) {
  throw new Error("WHATSAPP_ALLOWLIST contains an invalid phone")
}
const allowlistValues = normalizedAllowlist.flatMap((entry) =>
  entry.ok ? [entry.phoneE164] : [],
)
if (globalEnabled && !allowAll && allowlistValues.length === 0) {
  throw new Error("WHATSAPP_ALLOWLIST is required unless WHATSAPP_ALLOW_ALL=true")
}
const dispatchSafety = validateWhatsAppDispatchSafety({
  minDelayMs: numberEnv("WHATSAPP_MIN_DELAY_MS", 8_000),
  maxDelayMs: numberEnv("WHATSAPP_MAX_DELAY_MS", 15_000),
  hourlyLimit: numberEnv("WHATSAPP_HOURLY_LIMIT", 200),
})
const engine = new WhatsAppWorkerEngine(randomUUID(), repository, provider, {
  publicAppUrl: required("PUBLIC_APP_URL").replace(/\/$/, ""),
  minDelayMs: dispatchSafety.minDelayMs,
  maxDelayMs: dispatchSafety.maxDelayMs,
  hourlyLimit: dispatchSafety.hourlyLimit,
  globalEnabled,
  allowlist: allowAll ? null : new Set(allowlistValues),
})

const port = numberEnv("PORT", 3001)
const healthServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ ok: true, provider: "baileys" }))
    return
  }
  if (request.url === "/ready") {
    const connected = provider.isConnected()
    response.writeHead(connected ? 200 : 503, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ ok: connected, connected, provider: "baileys" }))
    return
  }
  response.writeHead(404).end()
})
healthServer.listen(port)

let stopping = false
async function shutdown() {
  if (stopping) return
  stopping = true
  healthServer.close()
  await engine.stop()
}
process.on("SIGTERM", () => void shutdown())
process.on("SIGINT", () => void shutdown())

void engine.run().catch(async (error) => {
  console.error("whatsapp_worker_fatal", operationalErrorMessage(error))
  await shutdown()
  process.exitCode = 1
})
