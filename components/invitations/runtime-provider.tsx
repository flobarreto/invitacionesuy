"use client"

import { createContext, useContext } from "react"
import type { InvitationDefinition } from "@/lib/invitations/types"

const InvitationRuntimeContext = createContext<InvitationDefinition | null>(null)

export function InvitationRuntimeProvider({
  definition,
  children,
}: {
  definition: InvitationDefinition
  children: React.ReactNode
}) {
  return (
    <InvitationRuntimeContext.Provider value={definition}>
      {children}
    </InvitationRuntimeContext.Provider>
  )
}

export function useRuntimeInvitation() {
  return useContext(InvitationRuntimeContext)
}
