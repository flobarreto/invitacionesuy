import type { ReactNode } from "react"
import { buildInvitationMetadata } from "@/lib/invitations/metadata"
import { requireInvitationDefinition } from "@/lib/invitations/registry"

export const metadata = buildInvitationMetadata(
  requireInvitationDefinition("mica-tincho"),
)

export default function BodaMicaTinchoLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
