export type WhatsAppDispatchSafety = {
  minDelayMs: number
  maxDelayMs: number
  hourlyLimit: number
}

/** Hard ceilings/floors that environment variables may make stricter, never looser. */
export function validateWhatsAppDispatchSafety(
  input: WhatsAppDispatchSafety,
): WhatsAppDispatchSafety {
  if (
    !Number.isFinite(input.minDelayMs)
    || !Number.isFinite(input.maxDelayMs)
    || input.minDelayMs < 8_000
    || input.maxDelayMs < input.minDelayMs
  ) {
    throw new Error("WhatsApp delay range is unsafe")
  }
  if (
    !Number.isInteger(input.hourlyLimit)
    || input.hourlyLimit < 1
    || input.hourlyLimit > 200
  ) {
    throw new Error("WHATSAPP_HOURLY_LIMIT must be an integer between 1 and 200")
  }
  return input
}
