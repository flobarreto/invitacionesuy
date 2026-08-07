"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function WhatsAppPairing() {
  const [image, setImage] = useState<string | null>(null)
  const [status, setStatus] = useState("Esperando al worker…")

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const poll = async () => {
      try {
        const response = await fetch("/api/admin/whatsapp/pairing", { cache: "no-store" })
        const body = await response.json()
        if (!active) return
        if (!response.ok) throw new Error(body.error ?? "No se pudo consultar el QR")
        if (body.qr) {
          setImage(await QRCode.toDataURL(body.qr, { width: 360, margin: 2 }))
          setStatus("Escaneá este QR desde Dispositivos vinculados en WhatsApp.")
        } else {
          setImage(null)
          setStatus("No hay un QR pendiente. El número puede estar conectado o el worker apagado.")
        }
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Error inesperado")
      } finally {
        if (active) timer = setTimeout(poll, 5_000)
      }
    }
    timer = setTimeout(poll, 0)
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <main className="mx-auto max-w-xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Vincular número de WhatsApp</CardTitle>
          <CardDescription>Disponible únicamente para administradores de plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {image ? <img src={image} alt="QR de vinculación de WhatsApp" className="mx-auto max-w-full" /> : <div className="mx-auto grid aspect-square w-72 place-items-center rounded-md bg-muted text-sm text-muted-foreground">Sin QR pendiente</div>}
          <p className="text-sm text-muted-foreground">{status}</p>
        </CardContent>
      </Card>
    </main>
  )
}

