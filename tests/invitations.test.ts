import assert from "node:assert/strict"
import test from "node:test"
import { getTimeLeft } from "../lib/invitations/countdown"
import { getRsvpLifecycleStatus } from "../lib/invitations/lifecycle"
import {
  getInvitationByLegacyRsvpEvent,
  getInvitationDefinition,
  getLegacyRsvpEndpoint,
} from "../lib/invitations/registry"
import { invitationConfigSchema } from "../lib/invitations/schema"
import { applyRuntimeEvent } from "../lib/invitations/runtime"
import { buildGoogleCalendarUrl, buildInvitationIcs } from "../lib/invitations/calendar"
import rawDefinitions from "../lib/invitations/config.json"

test("la configuración completa cumple el contrato", () => {
  assert.equal(invitationConfigSchema.safeParse(rawDefinitions).success, true)
})

test("los aliases legacy resuelven a la ruta canónica", () => {
  assert.equal(getInvitationDefinition("/bodaDomi&Diego")?.slug, "domi-diego")
  assert.equal(
    getInvitationDefinition("/invitaciones/bodaVir%26Jere")?.slug,
    "vir-jere",
  )
  assert.equal(getInvitationDefinition("mica-y-santi-v1-web")?.slug, "mica-santi")
})

test("Calas usa su propio endpoint y tabla", () => {
  assert.equal(getLegacyRsvpEndpoint("calas"), "/api/rsvp/bodaCalas")
  assert.equal(
    getInvitationByLegacyRsvpEvent("bodaCalas")?.legacy.rsvpTable,
    "boda_calas",
  )
})

test("Domi y Domi-hotel comparten renderer con variantes tipadas", () => {
  const defaultInvitation = getInvitationDefinition("domi-diego")
  const hotelInvitation = getInvitationDefinition("domi-diego-hotel")

  assert.equal(defaultInvitation?.renderer, "legacy-domi-diego")
  assert.equal(defaultInvitation?.variant, "default")
  assert.equal(hotelInvitation?.renderer, "legacy-domi-diego")
  assert.equal(hotelInvitation?.variant, "hotel")
})

test("las fechas corregidas son canónicas", () => {
  assert.equal(
    getInvitationDefinition("andres-lucre")?.event.startsAt,
    "2026-03-21T20:00:00-03:00",
  )
  assert.equal(
    getInvitationDefinition("vir-jere")?.event.startsAt,
    "2026-03-14T17:00:00-03:00",
  )
  assert.equal(
    getInvitationDefinition("calas")?.rsvp.closesAt,
    "2026-03-15T00:00:00-03:00",
  )
})

test("el lifecycle no reabre una boda pasada", () => {
  const definition = getInvitationDefinition("andres-lucre")
  assert.ok(definition)
  assert.equal(
    getRsvpLifecycleStatus(definition, new Date("2026-08-05T12:00:00-03:00")),
    "closed",
  )
})

test("el lifecycle distingue scheduled, open y closed", () => {
  const definition = {
    event: { startsAt: "2027-06-20T20:00:00-03:00" },
    rsvp: {
      enabled: true,
      opensAt: "2027-05-01T00:00:00-03:00",
      closesAt: "2027-06-01T00:00:00-03:00",
    },
  }
  assert.equal(
    getRsvpLifecycleStatus(definition, new Date("2027-04-30T23:59:00-03:00")),
    "scheduled",
  )
  assert.equal(
    getRsvpLifecycleStatus(definition, new Date("2027-05-10T12:00:00-03:00")),
    "open",
  )
  assert.equal(
    getRsvpLifecycleStatus(
      { ...definition, rsvp: { ...definition.rsvp, status: "scheduled" as const } },
      new Date("2027-05-10T12:00:00-03:00"),
    ),
    "open",
  )
  assert.equal(
    getRsvpLifecycleStatus(definition, new Date("2027-06-01T00:00:00-03:00")),
    "closed",
  )
})

test("el countdown usa la fecha absoluta configurada", () => {
  assert.deepEqual(
    getTimeLeft(
      "2026-03-21T20:00:00-03:00",
      new Date("2026-03-20T20:00:00-03:00"),
    ),
    { days: 1, hours: 0, minutes: 0 },
  )
})

test("la fecha y el estado runtime de events reemplazan la copia estática", () => {
  const definition = getInvitationDefinition("calas")
  assert.ok(definition)
  const runtime = applyRuntimeEvent(definition, {
    slug: "calas",
    display_name: "Juli & Mati",
    event_at: "2027-04-10T20:00:00-03:00",
    timezone: "America/Montevideo",
    rsvp_status: "scheduled",
    rsvp_opens_at: "2027-03-01T00:00:00-03:00",
    rsvp_deadline: "2027-03-30T00:00:00-03:00",
  })

  assert.equal(runtime.event.startsAt, "2027-04-10T20:00:00-03:00")
  assert.equal(runtime.rsvp.status, "scheduled")
  assert.equal(
    getRsvpLifecycleStatus(runtime, new Date("2027-02-20T12:00:00-03:00")),
    "scheduled",
  )
  assert.match(buildGoogleCalendarUrl(runtime), /20270410T230000Z%2F20270411T070000Z/)
  assert.match(buildInvitationIcs(runtime) ?? "", /DTSTART:20270410T230000Z/)
})
