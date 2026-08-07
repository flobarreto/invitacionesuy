"use client"

import { useEffect, useState } from "react"
import type { TimeLeft } from "@/app/utils/countdown"
import { getTimeLeft } from "@/lib/invitations/countdown"
import { useInvitationDefinition } from "./use-invitation-definition"
import type { InvitationDefinition } from "@/lib/invitations/types"

const EMPTY_TIME_LEFT: TimeLeft = { days: 0, hours: 0, minutes: 0 }

export function useInvitationCountdown(
  slugOrDefinition: string | InvitationDefinition,
  options?: { includeSeconds?: boolean },
): TimeLeft {
  const definition = useInvitationDefinition(slugOrDefinition)
  const target = definition.event.startsAt
  const includeSeconds = options?.includeSeconds === true
  // The server and browser do not share the exact same clock. Rendering a
  // live value during SSR can therefore cross a minute/day boundary and cause
  // a hydration mismatch. Start from a stable snapshot and update immediately
  // after hydration.
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(EMPTY_TIME_LEFT)

  useEffect(() => {
    if (!target) {
      setTimeLeft(EMPTY_TIME_LEFT)
      return
    }

    const update = () =>
      setTimeLeft(getTimeLeft(target, Date.now(), { includeSeconds }))
    update()
    const timer = window.setInterval(update, includeSeconds ? 1_000 : 30_000)
    return () => window.clearInterval(timer)
  }, [includeSeconds, target])

  return timeLeft
}
