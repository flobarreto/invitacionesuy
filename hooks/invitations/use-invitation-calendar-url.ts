"use client"

import { useMemo } from "react"
import { buildGoogleCalendarUrl } from "@/lib/invitations/calendar"
import type { InvitationDefinition } from "@/lib/invitations/types"
import { useInvitationDefinition } from "./use-invitation-definition"

export function useInvitationCalendarUrl(
  slugOrDefinition: string | InvitationDefinition,
) {
  const definition = useInvitationDefinition(slugOrDefinition)
  return useMemo(() => buildGoogleCalendarUrl(definition), [definition])
}
