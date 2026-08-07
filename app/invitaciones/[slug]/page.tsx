import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { buildInvitationMetadata } from "@/lib/invitations/metadata"
import { getInvitationDefinition } from "@/lib/invitations/registry"
import { invitationRenderers } from "@/lib/invitations/renderers"
import { PersonalizedRsvp } from "@/components/invitations/personalized-rsvp"
import { InvitationRuntimeProvider } from "@/components/invitations/runtime-provider"
import { InvitationRuntimeError, loadRuntimeInvitationDefinition } from "@/lib/invitations/runtime"

export const dynamic = "force-dynamic"

type InvitationPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string | string[] }>
}

export async function generateMetadata({
  params,
}: InvitationPageProps): Promise<Metadata> {
  const { slug } = await params
  const definition = getInvitationDefinition(slug)
  return definition ? buildInvitationMetadata(definition) : {}
}

export default async function InvitationPage({ params, searchParams }: InvitationPageProps) {
  const { slug } = await params
  const query = await searchParams
  const definition = getInvitationDefinition(slug)
  if (!definition) notFound()
  if (slug !== definition.slug) {
    const token = Array.isArray(query.token) ? query.token[0] : query.token
    redirect(
      `/invitaciones/${definition.slug}${token ? `?token=${encodeURIComponent(token)}` : ""}`,
    )
  }

  let runtimeDefinition
  try {
    runtimeDefinition = await loadRuntimeInvitationDefinition(definition)
  } catch (error) {
    if (error instanceof InvitationRuntimeError && error.status === 404) notFound()
    throw error
  }

  const loadRenderer = invitationRenderers[runtimeDefinition.renderer]
  const { default: Renderer } = await loadRenderer(runtimeDefinition)
  const token = Array.isArray(query.token) ? query.token[0] : query.token

  return (
    <InvitationRuntimeProvider definition={runtimeDefinition}>
      <Renderer definition={runtimeDefinition} />
      {token && token.length >= 32 && token.length <= 256 ? (
        <PersonalizedRsvp slug={runtimeDefinition.eventKey} token={token} />
      ) : null}
    </InvitationRuntimeProvider>
  )
}
