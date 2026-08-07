import type { ReactNode } from "react"
import { buildInvitationMetadata } from "@/lib/invitations/metadata"
import { requireInvitationDefinition } from "@/lib/invitations/registry"

export const metadata = buildInvitationMetadata(
  requireInvitationDefinition("calas"),
)

export default function BodaCalasLayout({ children }: { children: ReactNode }) {
  return children
}
