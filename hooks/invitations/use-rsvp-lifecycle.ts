"use client"

import { useEffect, useState } from "react"
import {
  getRsvpLifecycleMessage,
  getRsvpLifecycleStatus,
} from "@/lib/invitations/lifecycle"
import { useInvitationDefinition } from "./use-invitation-definition"
import type {
  InvitationDefinition,
  RsvpLifecycleStatus,
} from "@/lib/invitations/types"

export function useRsvpLifecycle(
  slugOrDefinition: string | InvitationDefinition,
): {
  status: RsvpLifecycleStatus
  isOpen: boolean
  message: string
} {
  const definition = useInvitationDefinition(slugOrDefinition)
  const [status, setStatus] = useState<RsvpLifecycleStatus>(() =>
    getRsvpLifecycleStatus(definition),
  )

  useEffect(() => {
    const update = () => setStatus(getRsvpLifecycleStatus(definition))
    update()
    const timer = window.setInterval(update, 30_000)
    return () => window.clearInterval(timer)
  }, [definition])

  return {
    status,
    isOpen: status === "open",
    message: getRsvpLifecycleMessage(status),
  }
}
