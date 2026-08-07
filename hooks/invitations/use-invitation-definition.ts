"use client"

import { useMemo } from "react"
import { useRuntimeInvitation } from "@/components/invitations/runtime-provider"
import { requireInvitationDefinition } from "@/lib/invitations/registry"
import type { InvitationDefinition } from "@/lib/invitations/types"

export function useInvitationDefinition(
  slugOrDefinition: string | InvitationDefinition,
): InvitationDefinition {
  const runtime = useRuntimeInvitation()

  return useMemo(() => {
    const requested = typeof slugOrDefinition === "string"
      ? requireInvitationDefinition(slugOrDefinition)
      : slugOrDefinition

    if (!runtime || runtime.eventKey !== requested.eventKey) return requested
    return {
      ...requested,
      coupleNames: runtime.coupleNames,
      event: runtime.event,
      rsvp: runtime.rsvp,
    }
  }, [runtime, slugOrDefinition])
}
