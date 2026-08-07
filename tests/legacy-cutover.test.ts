import assert from "node:assert/strict"
import test from "node:test"
import {
  AuthError,
  getLegacyAdminTransitionPayload,
  LegacyAdminTransitionError,
} from "@/lib/auth"
import { legacyRsvpDeleteSchema } from "@/lib/legacy-rsvp-delete"

const EVENT_ID = "71000000-0000-4000-8000-000000000099"

test("legacy admin cutover produces a typed canonical redirect", () => {
  const payload = getLegacyAdminTransitionPayload(
    new LegacyAdminTransitionError(EVENT_ID, "LEGACY_CUTOVER_COMPLETE"),
  )

  assert.deepEqual(payload, {
    error: "Este panel fue migrado al CRM del evento.",
    code: "LEGACY_CUTOVER_COMPLETE",
    eventId: EVENT_ID,
    redirectTo: `/admin/events/${EVENT_ID}/crm`,
  })
  assert.equal(
    getLegacyAdminTransitionPayload(
      new AuthError("Unauthorized", 401, "UNAUTHORIZED"),
    ),
    null,
  )
})

test("legacy admin write pause is distinguishable from completed cutover", () => {
  const payload = getLegacyAdminTransitionPayload(
    new LegacyAdminTransitionError(EVENT_ID, "LEGACY_DUAL_WRITE_DISABLED"),
  )
  assert.equal(payload?.code, "LEGACY_DUAL_WRITE_DISABLED")
  assert.equal(payload?.redirectTo, `/admin/events/${EVENT_ID}/crm`)
})

test("legacy RSVP DELETE validates bounded scalar IDs and rejects extra input", () => {
  assert.equal(
    legacyRsvpDeleteSchema.safeParse({
      id: "71000000-0000-4000-8000-000000000003",
    }).success,
    true,
  )
  assert.equal(legacyRsvpDeleteSchema.safeParse({ id: 42 }).success, true)
  assert.equal(legacyRsvpDeleteSchema.safeParse({ id: "" }).success, false)
  assert.equal(
    legacyRsvpDeleteSchema.safeParse({ id: "guest:unsafe" }).success,
    false,
  )
  assert.equal(
    legacyRsvpDeleteSchema.safeParse({ id: "guest", eventId: EVENT_ID }).success,
    false,
  )
})

