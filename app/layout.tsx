import type React from "react"
import { Montserrat, Italianno } from "next/font/google"
import localFont from "next/font/local";
import "./globals.css"

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
})

const italianno = Italianno({
  subsets: ["latin"],
  variable: "--font-italianno",
  weight: "400",
  display: "swap",
})

const umekoPlum = localFont({
  src: "../public/fonts/Umeko Plum.otf",
  variable: "--font-umeko",
  display: "swap",
})

export const metadata = {
  title: "Invitaciones.uy - Invitaciones digitales personalizadas",
  description: "Diseñamos invitaciones digitales a medida para casamientos y fiestas en Uruguay",
  generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${montserrat.variable} ${italianno.variable} ${umekoPlum.variable} antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Dynalight&family=Lora:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet"/>
        <link href="https://api.fontshare.com/v2/css?f[]=boska@400,500,600,700&display=swap" rel="stylesheet"/>
       
         </head>
      <body className="font-sans">{children}</body>
    </html>
  )
}
