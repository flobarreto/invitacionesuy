import type { Metadata } from "next";
import type { ReactNode } from "react";

function getMetadataBase(): URL {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://invitia.uy");
  return new URL(`${base}/`);
}

/** Ruta codificada para og:image (evita que `&` se interprete como inicio de query). */
const OG_IMAGE_PATH = "/bodaMica%26Santi/meta-foto.jpeg";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "Mica & Santi",
  description: "SAVE THE DATE",
  openGraph: {
    title: "Mica & Santi",
    description: "SAVE THE DATE",
    type: "website",
    locale: "es_UY",
    images: [
      {
        url: OG_IMAGE_PATH,
        alt: "Mica & Santi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mica & Santi",
    description: "SAVE THE DATE",
    images: [OG_IMAGE_PATH],
  },
};

export default function BodaMicaSantiLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
