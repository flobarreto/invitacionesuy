"use client"

import { useCallback, useRef, useState } from "react"
import { useRsvpLifecycle } from "./use-rsvp-lifecycle"
import { getLegacyRsvpEndpoint } from "@/lib/invitations/registry"
import { useInvitationDefinition } from "./use-invitation-definition"
import type {
  InvitationDefinition,
  RsvpPayload,
  RsvpSubmissionFeedback,
} from "@/lib/invitations/types"

type UseRsvpSubmissionOptions = {
  onSuccess?: () => void
}

type SubmitOptions = {
  successMessage?: string
  onSuccess?: () => void
}

export function useRsvpSubmission(
  slugOrDefinition: string | InvitationDefinition,
  options?: UseRsvpSubmissionOptions,
) {
  const definition = useInvitationDefinition(slugOrDefinition)
  const lifecycle = useRsvpLifecycle(definition)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<RsvpSubmissionFeedback | null>(null)
  const submittingRef = useRef(false)
  const pendingRequestRef = useRef<{
    payload: string
    idempotencyKey: string
  } | null>(null)

  const resetFeedback = useCallback(() => setFeedback(null), [])
  const ensureOpen = useCallback(() => {
    if (lifecycle.isOpen) return true
    setFeedback({ type: "error", message: lifecycle.message })
    return false
  }, [lifecycle.isOpen, lifecycle.message])

  const submit = useCallback(
    async (payload: RsvpPayload, submitOptions?: SubmitOptions): Promise<boolean> => {
      setFeedback(null)
      if (!ensureOpen() || submittingRef.current) return false

      submittingRef.current = true
      setIsSubmitting(true)
      try {
        const serializedPayload = JSON.stringify(payload)
        if (pendingRequestRef.current?.payload !== serializedPayload) {
          pendingRequestRef.current = {
            payload: serializedPayload,
            idempotencyKey: crypto.randomUUID(),
          }
        }
        const response = await fetch(getLegacyRsvpEndpoint(definition.slug), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": pendingRequestRef.current.idempotencyKey,
          },
          body: serializedPayload,
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(
            body?.error ??
              "No pudimos guardar tu respuesta. Intenta nuevamente.",
          )
        }

        setFeedback({
          type: "success",
          message:
            submitOptions?.successMessage ??
            "¡Gracias! Registramos tu respuesta.",
        })
        pendingRequestRef.current = null
        options?.onSuccess?.()
        submitOptions?.onSuccess?.()
        return true
      } catch (error) {
        setFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Ocurrió un error inesperado. Intenta nuevamente.",
        })
        return false
      } finally {
        submittingRef.current = false
        setIsSubmitting(false)
      }
    }, [definition.slug, ensureOpen, options])

  return {
    ...lifecycle,
    feedback,
    isSubmitting,
    ensureOpen,
    resetFeedback,
    setFeedback,
    submit,
  }
}
