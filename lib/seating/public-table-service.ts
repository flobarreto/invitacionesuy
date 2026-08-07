import type { SupabaseClient } from "@supabase/supabase-js"
import { CrmError, unavailable } from "@/lib/crm/errors"
import { hashInvitationToken } from "@/lib/crm/tokens"
import {
  opaqueInvitationTokenSchema,
  publicTableEventSlugSchema,
  type PublicTableAssignment,
} from "@/lib/seating/public-table-contract"
import { supabaseAdmin } from "@/lib/supabase"

type SeatingTableRelation = {
  label: string | null
  code: string | null
}

export type PublicTableGuestRow = {
  name: string
  attendance_status: string
  seating_tables:
    | SeatingTableRelation
    | SeatingTableRelation[]
    | null
}

function notFound(): never {
  throw new CrmError(
    "Invitación no encontrada.",
    "INVITATION_NOT_FOUND",
    404,
  )
}

function tableRelation(
  relation: PublicTableGuestRow["seating_tables"],
): SeatingTableRelation | null {
  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

export function publicTableAssignmentsFromRows(
  rows: readonly PublicTableGuestRow[],
): PublicTableAssignment[] {
  return rows
    .filter((row) => row.attendance_status === "attending")
    .map((row) => {
      const table = tableRelation(row.seating_tables)
      return {
        name: row.name.trim(),
        table: table?.label?.trim() || table?.code?.trim() || null,
      }
    })
    .filter((row) => row.name.length > 0)
    .sort((left, right) =>
      left.name.localeCompare(right.name, "es-UY", {
        sensitivity: "base",
      }),
    )
    .slice(0, 30)
}

export async function getPublicTableAssignments(
  eventSlugInput: string,
  tokenInput: string,
  client: SupabaseClient | null = supabaseAdmin,
): Promise<PublicTableAssignment[]> {
  const eventSlug = publicTableEventSlugSchema.safeParse(eventSlugInput)
  const token = opaqueInvitationTokenSchema.safeParse(tokenInput)
  if (!eventSlug.success || !token.success) notFound()
  if (!client) throw unavailable("public_table_lookup_not_configured")

  const { data: event, error: eventError } = await client
    .from("events")
    .select("id")
    .eq("slug", eventSlug.data)
    .maybeSingle()

  if (eventError) throw unavailable("public_table_event_lookup_failed")
  if (!event) notFound()

  const { data: group, error: groupError } = await client
    .from("invitation_groups")
    .select("id")
    .eq("event_id", event.id)
    .eq("invitation_token_hash", hashInvitationToken(token.data))
    .maybeSingle()

  if (groupError) throw unavailable("public_table_group_lookup_failed")
  if (!group) notFound()

  const { data: guests, error: guestsError } = await client
    .from("guests")
    .select("name,attendance_status,seating_tables(label,code)")
    .eq("event_id", event.id)
    .eq("group_id", group.id)
    .eq("attendance_status", "attending")
    .order("created_at", { ascending: true })
    .limit(30)

  if (guestsError) throw unavailable("public_table_guests_lookup_failed")

  return publicTableAssignmentsFromRows(
    (guests ?? []) as unknown as PublicTableGuestRow[],
  )
}
