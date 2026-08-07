import type { TimeLeft } from "@/app/utils/countdown"

export function getTimeLeft(
  targetISOString: string,
  now: Date | number = Date.now(),
  options?: { includeSeconds?: boolean },
): TimeLeft {
  const target = Date.parse(targetISOString)
  const nowMs = typeof now === "number" ? now : now.getTime()
  const difference = Number.isFinite(target) ? Math.max(0, target - nowMs) : 0

  const days = Math.floor(difference / 86_400_000)
  const hours = Math.floor((difference % 86_400_000) / 3_600_000)
  const minutes = Math.floor((difference % 3_600_000) / 60_000)

  if (options?.includeSeconds) {
    return {
      days,
      hours,
      minutes,
      seconds: Math.floor((difference % 60_000) / 1_000),
    }
  }

  return { days, hours, minutes }
}
