import type { Metadata } from "next"
import type { ReactNode } from "react"

function getMetadataBase(): URL {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://invitia.uy")
  return new URL(`${base}/`)
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "Tu mesa — Domi & Diego",
  description: "Buscá tu nombre para ver el número de mesa.",
  robots: { index: false, follow: false },
}

export default function MesasCalasLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
