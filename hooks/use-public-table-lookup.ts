"use client"

import { useEffect, useMemo, useState } from "react"
import {
  opaqueInvitationTokenSchema,
  publicTableLookupResponseSchema,
  type PublicTableAssignment,
} from "@/lib/seating/public-table-contract"

export type PublicTableLookupState =
  | { status: "missing"; assignments: [] }
  | { status: "invalid"; assignments: [] }
  | { status: "loading"; assignments: [] }
  | { status: "error"; assignments: []; message: string }
  | { status: "ready"; assignments: PublicTableAssignment[] }

function publicErrorMessage(status: number): string {
  if (status === 404) {
    return "Este enlace no es válido o ya no está disponible. Pediles a los novios que te reenvíen tu invitación."
  }
  if (status === 429) {
    return "Hiciste demasiadas consultas. Esperá un momento y volvé a intentar."
  }
  return "No pudimos consultar tu mesa ahora. Probá de nuevo en unos minutos."
}

export function usePublicTableLookup(
  endpoint: string,
  rawToken: unknown,
): PublicTableLookupState {
  const tokenState = useMemo(() => {
    if (rawToken === undefined || rawToken === null) {
      return { kind: "missing" as const, token: null }
    }
    if (typeof rawToken !== "string") {
      return { kind: "invalid" as const, token: null }
    }
    const parsed = opaqueInvitationTokenSchema.safeParse(rawToken)
    return parsed.success
      ? { kind: "valid" as const, token: parsed.data }
      : { kind: "invalid" as const, token: null }
  }, [rawToken])
  const [state, setState] = useState<PublicTableLookupState>(() =>
    tokenState.kind === "missing"
      ? { status: "missing", assignments: [] }
      : tokenState.kind === "invalid"
        ? { status: "invalid", assignments: [] }
        : { status: "loading", assignments: [] },
  )

  useEffect(() => {
    if (tokenState.kind === "missing") {
      setState({ status: "missing", assignments: [] })
      return
    }
    if (tokenState.kind === "invalid" || !tokenState.token) {
      setState({ status: "invalid", assignments: [] })
      return
    }

    const controller = new AbortController()
    setState({ status: "loading", assignments: [] })

    void (async () => {
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          credentials: "omit",
          headers: { Authorization: `Bearer ${tokenState.token}` },
          referrerPolicy: "no-referrer",
          signal: controller.signal,
        })
        const body: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(publicErrorMessage(response.status))
        }

        const parsed = publicTableLookupResponseSchema.safeParse(body)
        if (!parsed.success) {
          throw new Error(publicErrorMessage(503))
        }
        setState({ status: "ready", assignments: parsed.data.assignments })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({
          status: "error",
          assignments: [],
          message:
            error instanceof Error
              ? error.message
              : publicErrorMessage(503),
        })
      }
    })()

    return () => controller.abort()
  }, [endpoint, tokenState])

  return state
}
