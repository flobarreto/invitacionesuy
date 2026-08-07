import type { Metadata } from "next"
import type { InvitationDefinition } from "./types"

function getMetadataBase(): URL {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://invitia.uy")
  return new URL(`${base}/`)
}

export function buildInvitationMetadata(
  definition: InvitationDefinition,
): Metadata {
  const image = definition.metadata.image
  return {
    metadataBase: getMetadataBase(),
    title: definition.metadata.title,
    description: definition.metadata.description,
    openGraph: {
      title: definition.metadata.title,
      description: definition.metadata.description,
      type: "website",
      locale: "es_UY",
      ...(image
        ? { images: [{ url: image, alt: definition.metadata.title }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: definition.metadata.title,
      description: definition.metadata.description,
      ...(image ? { images: [image] } : {}),
    },
  }
}
