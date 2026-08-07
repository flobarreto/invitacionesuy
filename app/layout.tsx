import type React from "react"
import localFont from "next/font/local";
import "@fontsource-variable/montserrat/wght.css"
import "@fontsource/italianno/latin.css"
import "@fontsource/allura/latin.css"
import "@fontsource-variable/cormorant-garamond/wght.css"
import "@fontsource-variable/cormorant-garamond/wght-italic.css"
import "@fontsource-variable/bodoni-moda/wght.css"
import "@fontsource-variable/dancing-script/wght.css"
import "@fontsource/tangerine/latin.css"
import "@fontsource-variable/eb-garamond/wght.css"
import "@fontsource/dynalight/latin.css"
import "@fontsource-variable/lora/wght.css"
import "@fontsource-variable/lora/wght-italic.css"
import "@fontsource-variable/source-sans-3/wght.css"
import "@fontsource-variable/source-sans-3/wght-italic.css"
import "@fontsource/italiana/latin.css"
import "@fontsource/shadows-into-light/latin.css"
import "@fontsource/instrument-serif/latin.css"
import "@fontsource/instrument-serif/latin-italic.css"
import "@fontsource-variable/hanken-grotesk/wght.css"
import "@fontsource-variable/hanken-grotesk/wght-italic.css"
import "@fontsource-variable/playwrite-no/wght.css"
import "./globals.css"

const umekoPlum = localFont({
  src: "../public/fonts/Umeko Plum.otf",
  variable: "--font-umeko",
  display: "swap",
})

export const metadata = {
  title: "invitia.uy - Invitaciones digitales personalizadas",
  description: "Diseñamos invitaciones digitales a medida para eventos",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="es"
      className={`${umekoPlum.variable} antialiased`}
    >
      <body className="font-sans">{children}</body>
    </html>
  )
}
