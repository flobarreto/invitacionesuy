"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Loader2, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type PublicGuest = {
  id: string
  name: string
  attendanceStatus: "pending" | "attending" | "declined"
  dietaryPreferences: string[]
  favoriteSong: string | null
}

type PublicInvitation = {
  event: {
    displayName: string
    rsvpStatus: "scheduled" | "open" | "closed"
    rsvpDeadline: string | null
  }
  group: {
    displayName: string
    guests: PublicGuest[]
  }
}

type Answer = {
  attendanceStatus: "attending" | "declined" | null
  dietaryPreferences: string
  favoriteSong: string
}

function initialAnswer(guest: PublicGuest): Answer {
  return {
    attendanceStatus:
      guest.attendanceStatus === "pending" ? null : guest.attendanceStatus,
    dietaryPreferences: guest.dietaryPreferences.join(", "),
    favoriteSong: guest.favoriteSong ?? "",
  }
}

export function PersonalizedRsvp({ slug, token }: { slug: string; token: string }) {
  const [invitation, setInvitation] = useState<PublicInvitation | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(
          `/api/events/${encodeURIComponent(slug)}/rsvp?token=${encodeURIComponent(token)}`,
          { signal: controller.signal, cache: "no-store" },
        )
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "No pudimos abrir esta invitación.")
        const nextInvitation = body as PublicInvitation
        setInvitation(nextInvitation)
        setAnswers(
          Object.fromEntries(
            nextInvitation.group.guests.map((guest) => [guest.id, initialAnswer(guest)]),
          ),
        )
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return
        setError(loadError instanceof Error ? loadError.message : "No pudimos abrir esta invitación.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [slug, token])

  const isComplete = useMemo(
    () =>
      Boolean(
        invitation?.group.guests.length &&
          invitation.group.guests.every((guest) => answers[guest.id]?.attendanceStatus),
      ),
    [answers, invitation],
  )

  const updateAnswer = (guestId: string, patch: Partial<Answer>) => {
    setSaved(false)
    setAnswers((current) => ({
      ...current,
      [guestId]: { ...current[guestId], ...patch },
    }))
  }

  const submit = async () => {
    if (!invitation || !isComplete || invitation.event.rsvpStatus !== "open") return
    setSubmitting(true)
    setError("")
    try {
      const responses = invitation.group.guests.map((guest) => {
        const answer = answers[guest.id]
        if (!answer?.attendanceStatus) throw new Error("Falta responder por un integrante.")
        return {
          guestId: guest.id,
          attendanceStatus: answer.attendanceStatus,
          ...(answer.attendanceStatus === "attending" && {
            dietaryPreferences: answer.dietaryPreferences
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            favoriteSong: answer.favoriteSong.trim() || undefined,
          }),
        }
      })

      const response = await fetch(`/api/events/${encodeURIComponent(slug)}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, responses }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "No pudimos guardar la respuesta.")
      setSaved(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pudimos guardar la respuesta.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-xl items-center justify-center gap-2 rounded-full bg-white/95 px-5 py-3 text-sm text-neutral-700 shadow-2xl backdrop-blur">
        <Loader2 className="h-4 w-4 animate-spin" /> Preparando tu invitación…
      </div>
    )
  }

  if (!invitation) {
    return error ? (
      <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl rounded-2xl bg-red-50 px-5 py-3 text-center text-sm text-red-800 shadow-2xl">
        {error}
      </div>
    ) : null
  }

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-black/10 bg-white/95 p-3 text-neutral-900 shadow-2xl backdrop-blur md:p-4">
        <div className="hidden rounded-full bg-neutral-100 p-2 sm:block">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-neutral-500">Invitación para</p>
          <p className="truncate font-medium">{invitation.group.displayName}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          {saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Respuesta guardada" : "Confirmar asistencia"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmación para {invitation.group.displayName}</DialogTitle>
            <DialogDescription>
              Respondé por cada integrante. Podés volver a este enlace para cambiar una respuesta.
            </DialogDescription>
          </DialogHeader>

          {invitation.event.rsvpStatus !== "open" ? (
            <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              La confirmación para {invitation.event.displayName} no está abierta en este momento.
            </p>
          ) : (
            <div className="space-y-4">
              {invitation.group.guests.map((guest) => {
                const answer = answers[guest.id] ?? initialAnswer(guest)
                return (
                  <section key={guest.id} className="rounded-xl border p-4">
                    <p className="mb-3 font-medium">¿Asiste {guest.name}?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={answer.attendanceStatus === "attending" ? "default" : "outline"}
                        onClick={() => updateAnswer(guest.id, { attendanceStatus: "attending" })}
                      >
                        <Check className="h-4 w-4" /> Sí, asiste
                      </Button>
                      <Button
                        type="button"
                        variant={answer.attendanceStatus === "declined" ? "destructive" : "outline"}
                        onClick={() => updateAnswer(guest.id, { attendanceStatus: "declined" })}
                      >
                        <X className="h-4 w-4" /> No asiste
                      </Button>
                    </div>
                    {answer.attendanceStatus === "attending" ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-sm">
                          Restricciones alimentarias
                          <input
                            className="mt-1 w-full rounded-md border bg-white px-3 py-2"
                            value={answer.dietaryPreferences}
                            onChange={(event) =>
                              updateAnswer(guest.id, { dietaryPreferences: event.target.value })
                            }
                            placeholder="Ej.: vegetariano, celíaco"
                          />
                        </label>
                        <label className="text-sm">
                          Canción sugerida
                          <input
                            className="mt-1 w-full rounded-md border bg-white px-3 py-2"
                            value={answer.favoriteSong}
                            onChange={(event) =>
                              updateAnswer(guest.id, { favoriteSong: event.target.value })
                            }
                            placeholder="Artista – canción"
                          />
                        </label>
                      </div>
                    ) : null}
                  </section>
                )
              })}

              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              {saved ? (
                <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                  ¡Gracias! Guardamos la respuesta de todo el grupo.
                </p>
              ) : null}
              <Button className="w-full" disabled={!isComplete || submitting} onClick={() => void submit()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? "Guardando…" : "Guardar respuestas"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
