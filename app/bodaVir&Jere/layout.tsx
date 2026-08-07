import type { ReactNode } from "react"
import { buildInvitationMetadata } from "@/lib/invitations/metadata"
import { requireInvitationDefinition } from "@/lib/invitations/registry"

export const metadata = buildInvitationMetadata(
  requireInvitationDefinition("vir-jere"),
)

export default function BodaVirJereLayout({ children }: { children: ReactNode }) {
  return children
}
