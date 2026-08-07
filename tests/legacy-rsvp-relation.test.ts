import assert from "node:assert/strict"
import test from "node:test"
import {
  BLOCKED_LEGACY_RSVP_RELATIONS,
  validateLegacyRsvpTableName,
} from "@/lib/legacy-rsvp-relation"

test("acepta únicamente identificadores PostgreSQL simples y acotados", () => {
  for (const tableName of [
    "boda_domi_diego",
    "boda_sofi_gonchi_rsvps",
    "fixture_legacy_rsvps",
  ]) {
    assert.deepEqual(validateLegacyRsvpTableName(tableName), {
      valid: true,
      reason: "ok",
      tableName,
    })
  }

  for (const tableName of [
    " public.rsvps",
    "public.rsvps",
    "RSVPS",
    "rsvp-table",
    "rsvps;drop_table",
    `r${"x".repeat(63)}`,
  ]) {
    assert.equal(validateLegacyRsvpTableName(tableName).valid, false)
  }
})

test("bloquea todas las relaciones canónicas aunque el identificador sea válido", () => {
  for (const tableName of BLOCKED_LEGACY_RSVP_RELATIONS) {
    assert.deepEqual(validateLegacyRsvpTableName(tableName), {
      valid: false,
      reason: "blocked_relation",
      tableName,
    })
  }
})

test("bloquea prefijos reservados de esquemas y extensiones", () => {
  for (const tableName of [
    "pg_shadow",
    "sql_features",
    "auth_users",
    "storage_objects",
    "realtime_messages",
    "supabase_migrations",
    "vault_secrets",
  ]) {
    assert.equal(
      validateLegacyRsvpTableName(tableName).reason,
      "blocked_relation",
    )
  }
})
