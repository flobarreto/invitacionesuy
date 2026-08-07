export type PhoneNormalizationResult =
  | { ok: true; phoneE164: string }
  | { ok: false; reason: "missing" | "invalid" }

const MIN_E164_DIGITS = 8
const MAX_E164_DIGITS = 15

/**
 * Normalizes a phone without depending on browser locale. Uruguay (+598) is the
 * product default, but callers can pass another country calling code.
 */
export function normalizePhone(
  rawPhone: string,
  defaultCallingCode = "598",
): PhoneNormalizationResult {
  const input = rawPhone.trim().replace(/^(?:tel:|whatsapp:)/i, "")
  if (!input) return { ok: false, reason: "missing" }

  let normalized = input.replace(/[^\d+]/g, "")
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`

  if (!normalized.startsWith("+")) {
    const digits = normalized.replace(/\D/g, "").replace(/^0+/, "")
    normalized = digits.startsWith(defaultCallingCode)
      ? `+${digits}`
      : `+${defaultCallingCode}${digits}`
  }

  if (!/^\+[1-9]\d+$/.test(normalized)) {
    return { ok: false, reason: "invalid" }
  }

  const digitCount = normalized.length - 1
  if (digitCount < MIN_E164_DIGITS || digitCount > MAX_E164_DIGITS) {
    return { ok: false, reason: "invalid" }
  }

  // Uruguay numbers have exactly eight national digits. Fixed lines start in
  // 2 and mobile numbers in 9; accepting other shapes creates undeliverable
  // WhatsApp rows that only fail after a campaign has started.
  if (normalized.startsWith("+598") && !/^\+598[29]\d{7}$/.test(normalized)) {
    return { ok: false, reason: "invalid" }
  }

  return { ok: true, phoneE164: normalized }
}

export function phoneToWhatsAppJid(phoneE164: string) {
  const normalized = normalizePhone(phoneE164)
  if (!normalized.ok) throw new Error("Invalid E.164 phone")
  return `${normalized.phoneE164.slice(1)}@s.whatsapp.net`
}
