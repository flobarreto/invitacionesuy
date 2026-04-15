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
const OG_IMAGE_PATH = "/bodaDomi%26Diego/preview.jpeg";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "Boda Domi y Diego",
  description: "",
  openGraph: {
    title: "Boda Domi y Diego",
    description: "",
    type: "website",
    locale: "es_UY",
    images: [
      {
        url: OG_IMAGE_PATH,
        alt: "Domi y Diego",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Boda Domi y Diego",
    description: "",
    images: [OG_IMAGE_PATH],
  },
};

export default function BodaDomiDiegoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
