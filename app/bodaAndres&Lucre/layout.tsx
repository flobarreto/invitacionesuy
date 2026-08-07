import type { ReactNode } from "react"
import { buildInvitationMetadata } from "@/lib/invitations/metadata"
import { requireInvitationDefinition } from "@/lib/invitations/registry"

export const metadata = buildInvitationMetadata(
  requireInvitationDefinition("andres-lucre"),
)

export default function BodaAndresLucreLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
