"use client"

import { Button } from "@/components/ui/button"

export default function InvitationError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-50 p-6 text-neutral-900">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">La invitación no está disponible</h1>
        <p className="text-sm text-neutral-600">
          No pudimos consultar la fecha y el estado actual del evento. Intentá nuevamente en unos minutos.
        </p>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </main>
  )
}
