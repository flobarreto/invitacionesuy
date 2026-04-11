export interface TimeLeft {
  days: number
  hours: number
  minutes: number
  /** Solo presente cuando se llama con `{ includeSeconds: true }`. */
  seconds?: number
}

export type GetTimeLeftOptions = {
  /** Si es true, incluye `seconds` en el resultado. Por defecto es false. */
  includeSeconds?: boolean
}

/**
 * Calcula la diferencia en días/horas/minutos (y opcionalmente segundos) hasta una fecha/hora dada
 * interpretada en la zona horaria de Uruguay (America/Montevideo).
 *
 * @param targetISOString Fecha/hora objetivo en formato ISO con offset -03:00,
 *   por ejemplo: "2026-03-21T19:00:00-03:00"
 * @param options.includeSeconds Si es true, el objeto devuelto incluye `seconds`.
 */
export function getTimeLeftToUruguayDate(
  targetISOString: string,
  options?: GetTimeLeftOptions,
): TimeLeft {
  const includeSeconds = options?.includeSeconds === true
  const targetDate = new Date(targetISOString)

  const now = new Date()
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const year = parseInt(parts.find((p) => p.type === "year")!.value)
  const month = parseInt(parts.find((p) => p.type === "month")!.value) - 1
  const day = parseInt(parts.find((p) => p.type === "day")!.value)
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value)
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value)
  const second = parseInt(parts.find((p) => p.type === "second")!.value)

  const nowUruguay = new Date(
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(
      hour,
    ).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}-03:00`,
  )

  const difference = targetDate.getTime() - nowUruguay.getTime()

  if (difference <= 0) {
    return includeSeconds
      ? { days: 0, hours: 0, minutes: 0, seconds: 0 }
      : { days: 0, hours: 0, minutes: 0 }
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24))
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((difference % (1000 * 60)) / 1000)

  const base = {
    days: Math.max(0, days),
    hours: Math.max(0, hours),
    minutes: Math.max(0, minutes),
  }

  return includeSeconds ? { ...base, seconds: Math.max(0, seconds) } : base
}

