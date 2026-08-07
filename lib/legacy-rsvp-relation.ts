import { z } from "zod"
import { supabaseAdmin } from "@/lib/supabase"

const MAX_POSTGRES_IDENTIFIER_BYTES = 63

export const BLOCKED_LEGACY_RSVP_RELATIONS = [
  "admin",
  "admin_sessions",
  "api_rate_limits",
  "attendance_history",
  "crm_idempotency_records",
  "event_admins",
  "event_migration_state",
  "events",
  "floor_plan",
  "floor_plans",
  "floor_plans_legacy_admin",
  "guest_tags",
  "guests",
  "invitation_groups",
  "legacy_floor_plan_migration_runs",
  "legacy_floor_plan_reconciliation_audit",
  "legacy_floor_plan_source_versions",
  "legacy_floor_plan_sources",
  "legacy_migration_audit",
  "legacy_row_identities",
  "legacy_rsvp_relations",
  "legacy_rsvp_deletion_audit",
  "legacy_rsvp_idempotency_records",
  "legacy_rsvp_mapping_reviews",
  "legacy_tag_aliases",
  "message_campaign_alerts",
  "message_campaigns",
  "message_deliveries",
  "phone_suppressions",
  "seating_tables",
  "spatial_ref_sys",
  "tags",
  "whatsapp_auth_state",
  "whatsapp_conversations",
  "whatsapp_inbound_events",
  "whatsapp_outbound_jobs",
  "whatsapp_worker_leases",
] as const

const blockedRelations = new Set<string>(BLOCKED_LEGACY_RSVP_RELATIONS)
const blockedPrefixes = [
  "pg_",
  "sql_",
  "auth_",
  "storage_",
  "realtime_",
  "supabase_",
  "vault_",
]

export type LegacyRsvpTableName = string & {
  readonly __legacyRsvpTableName: unique symbol
}

export type LegacyRsvpRelationInspection =
  | {
      valid: true
      reason: "ok"
      tableName: LegacyRsvpTableName
      relationOid?: string
    }
  | {
      valid: false
      reason: string
      tableName?: string
      missingColumns?: string[]
      invalidColumns?: string[]
    }

const databaseInspectionSchema = z.object({
  valid: z.boolean(),
  reason: z.string().min(1),
  tableName: z.string().optional(),
  relationOid: z.string().optional(),
  missingColumns: z.array(z.string()).optional(),
  invalidColumns: z.array(z.string()).optional(),
}).passthrough()

export class LegacyRsvpInspectionUnavailableError extends Error {
  constructor(readonly details?: unknown) {
    super("Legacy RSVP relation inspection unavailable")
    this.name = "LegacyRsvpInspectionUnavailableError"
  }
}

export function validateLegacyRsvpTableName(
  value: unknown,
): LegacyRsvpRelationInspection {
  if (typeof value !== "string" || value.length === 0) {
    return { valid: false, reason: "invalid_identifier" }
  }
  if (
    value !== value.trim() ||
    value.length > MAX_POSTGRES_IDENTIFIER_BYTES ||
    !/^[a-z][a-z0-9_]*$/.test(value)
  ) {
    return { valid: false, reason: "invalid_identifier", tableName: value }
  }
  if (
    blockedRelations.has(value) ||
    blockedPrefixes.some((prefix) => value.startsWith(prefix))
  ) {
    return { valid: false, reason: "blocked_relation", tableName: value }
  }
  return {
    valid: true,
    reason: "ok",
    tableName: value as LegacyRsvpTableName,
  }
}

export async function inspectLegacyRsvpRelation(
  value: unknown,
): Promise<LegacyRsvpRelationInspection> {
  const localInspection = validateLegacyRsvpTableName(value)
  if (!localInspection.valid) return localInspection
  if (!supabaseAdmin) {
    throw new LegacyRsvpInspectionUnavailableError("Supabase no configurado")
  }

  const { data, error } = await supabaseAdmin.rpc(
    "authorize_legacy_rsvp_relation",
    { p_table_name: localInspection.tableName },
  )
  if (error) {
    throw new LegacyRsvpInspectionUnavailableError(error.message)
  }

  const parsed = databaseInspectionSchema.safeParse(data)
  if (!parsed.success) {
    throw new LegacyRsvpInspectionUnavailableError(
      parsed.error.flatten(),
    )
  }
  if (!parsed.data.valid) {
    return {
      valid: false,
      reason: parsed.data.reason,
      tableName: parsed.data.tableName,
      missingColumns: parsed.data.missingColumns,
      invalidColumns: parsed.data.invalidColumns,
    }
  }
  if (parsed.data.tableName !== localInspection.tableName) {
    throw new LegacyRsvpInspectionUnavailableError(
      "La inspección devolvió otra relación",
    )
  }

  return {
    valid: true,
    reason: "ok",
    tableName: localInspection.tableName,
    relationOid: parsed.data.relationOid,
  }
}
