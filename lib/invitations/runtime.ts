import type { SupabaseClient } from "@supabase/supabase-js"
import type { InvitationDefinition, RsvpLifecycleStatus } from "@/lib/invitations/types"
import { supabaseAdmin } from "@/lib/supabase"

export class InvitationRuntimeError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 503,
  ) {
    super(message)
    this.name = "InvitationRuntimeError"
  }
}

type EventRuntimeRow = {
  slug: string
  display_name: string
  event_at: string | null
  timezone: string
  rsvp_status: RsvpLifecycleStatus
  rsvp_opens_at: string | null
  rsvp_deadline: string | null
}

function staticAdapterEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_STATIC_INVITATION_EVENT_ADAPTER === "true"
  )
}

export function applyRuntimeEvent(
  definition: InvitationDefinition,
  event: EventRuntimeRow,
): InvitationDefinition {
  return {
    ...definition,
    coupleNames: event.display_name,
    event: {
      startsAt: event.event_at,
      timezone: event.timezone,
    },
    rsvp: {
      ...definition.rsvp,
      enabled: definition.capabilities.rsvp,
      status: event.rsvp_status,
      opensAt: event.rsvp_opens_at,
      closesAt: event.rsvp_deadline,
    },
  }
}

export async function loadRuntimeInvitationDefinition(
  definition: InvitationDefinition,
  client: SupabaseClient | null = supabaseAdmin,
): Promise<InvitationDefinition> {
  // Visual tests and local development must be deterministic even when the
  // developer has credentials for a Supabase project that has not received the
  // v2 migrations yet. Production can never enter this branch.
  if (staticAdapterEnabled()) return definition

  if (!client) {
    throw new InvitationRuntimeError("El servicio de invitaciones no está disponible.", 503)
  }

  const { data, error } = await client
    .from("events")
    .select("slug,display_name,event_at,timezone,rsvp_status,rsvp_opens_at,rsvp_deadline")
    .eq("slug", definition.eventKey)
    .maybeSingle()

  if (error) {
    throw new InvitationRuntimeError("El servicio de invitaciones no está disponible.", 503)
  }
  if (!data) {
    throw new InvitationRuntimeError("Invitación no encontrada.", 404)
  }

  return applyRuntimeEvent(definition, data as EventRuntimeRow)
}
