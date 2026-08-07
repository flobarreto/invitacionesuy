import assert from "node:assert/strict"
import test from "node:test"
import { CrmError, unavailable } from "@/lib/crm/errors"
import type { RateLimitInput } from "@/lib/crm/rate-limit"
import { mesasDomiDiegoQrTarget } from "@/lib/mesasDomiDiegoQr"
import {
  invitationTokenFromAuthorization,
  publicTableLookupResponseSchema,
} from "@/lib/seating/public-table-contract"
import {
  handlePublicTableLookup,
  resolvePublicTableEvent,
} from "@/lib/seating/public-table-route"
import { publicTableAssignmentsFromRows } from "@/lib/seating/public-table-service"

const TOKEN = "a".repeat(43)

test("public table tokens must be opaque base64url bearer credentials", () => {
  assert.equal(invitationTokenFromAuthorization(`Bearer ${TOKEN}`), TOKEN)
  assert.equal(invitationTokenFromAuthorization(TOKEN), null)
  assert.equal(invitationTokenFromAuthorization("Bearer short"), null)
  assert.equal(
    invitationTokenFromAuthorization(`Bearer ${"a".repeat(42)}%`),
    null,
  )
  assert.equal(invitationTokenFromAuthorization(null), null)
})

test("the legacy QR encodes a group-specific token", () => {
  const target = new URL(mesasDomiDiegoQrTarget(TOKEN))
  assert.equal(target.pathname, "/mesas-domi-diego")
  assert.equal(target.searchParams.get("token"), TOKEN)
  assert.equal(Array.from(target.searchParams.keys()).length, 1)
})

test("public assignments include only attending group members and expose no ids", () => {
  const result = publicTableAssignmentsFromRows([
    {
      name: " Zoe ",
      attendance_status: "attending",
      seating_tables: { label: " Mesa Jardín ", code: "J1" },
    },
    {
      name: "Ana",
      attendance_status: "attending",
      seating_tables: [{ label: "", code: " A2 " }],
    },
    {
      name: "Beto",
      attendance_status: "attending",
      seating_tables: null,
    },
    {
      name: "Pendiente",
      attendance_status: "pending",
      seating_tables: { label: "Mesa 9", code: "9" },
    },
    {
      name: "No asiste",
      attendance_status: "declined",
      seating_tables: { label: "Mesa 10", code: "10" },
    },
  ])

  assert.deepEqual(result, [
    { name: "Ana", table: "A2" },
    { name: "Beto", table: null },
    { name: "Zoe", table: "Mesa Jardín" },
  ])
  assert.ok(publicTableLookupResponseSchema.safeParse({ assignments: result }).success)
  assert.deepEqual(Object.keys(result[0] ?? {}).sort(), ["name", "table"])
})

test("table lookup rate limiting uses one fixed namespace and event scope", async () => {
  const calls: RateLimitInput[] = []
  const eventSlug = await resolvePublicTableEvent(
    new Request("https://invitia.uy/api/mesas/mxv"),
    "calas",
    async (input) => {
      calls.push(input)
    },
  )

  assert.equal(eventSlug, "calas")
  assert.equal(calls.length, 1)
  assert.deepEqual(
    {
      namespace: calls[0]?.namespace,
      scope: calls[0]?.scope,
      limit: calls[0]?.limit,
      windowSeconds: calls[0]?.windowSeconds,
    },
    {
      namespace: "public_table_lookup",
      scope: "calas",
      limit: 30,
      windowSeconds: 60,
    },
  )
})

test("unknown and non-table-search events fail closed before rate limiting", async () => {
  let calls = 0
  const consume = async () => {
    calls += 1
  }

  for (const event of ["does-not-exist", "sofi-gonchi"]) {
    await assert.rejects(
      resolvePublicTableEvent(
        new Request(`https://invitia.uy/api/mesas/${event}`),
        event,
        consume,
      ),
      (error: unknown) =>
        error instanceof CrmError &&
        error.status === 404 &&
        error.code === "INVITATION_NOT_FOUND",
    )
  }
  assert.equal(calls, 0)
})

test("table route rejects missing tokens without touching dependencies", async () => {
  let calls = 0
  const response = await handlePublicTableLookup(
    new Request("https://invitia.uy/api/mesas/mxv"),
    "calas",
    {
      consumeRateLimit: async () => {
        calls += 1
      },
      lookup: async () => {
        calls += 1
        return []
      },
    },
  )

  assert.equal(response.status, 404)
  assert.match(response.headers.get("cache-control") ?? "", /no-store/)
  assert.equal(calls, 0)
  assert.deepEqual(await response.json(), {
    error: "Invitación no encontrada.",
    code: "INVITATION_NOT_FOUND",
  })
})

test("table route returns a minimal private response for a valid group token", async () => {
  const calls: RateLimitInput[] = []
  const request = new Request("https://invitia.uy/api/mesas/mxv?q=ana", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const response = await handlePublicTableLookup(request, "calas", {
    consumeRateLimit: async (input) => {
      calls.push(input)
    },
    lookup: async (eventSlug, token) => {
      assert.equal(eventSlug, "calas")
      assert.equal(token, TOKEN)
      return [{ name: "Ana", table: "Mesa 4" }]
    },
  })

  assert.equal(response.status, 200)
  assert.match(response.headers.get("cache-control") ?? "", /no-store/)
  assert.equal(response.headers.get("vary"), "Authorization")
  assert.deepEqual(await response.json(), {
    assignments: [{ name: "Ana", table: "Mesa 4" }],
  })
  assert.equal(calls.length, 1)
})

test("table route maps unavailable infrastructure to 503", async () => {
  const response = await handlePublicTableLookup(
    new Request("https://invitia.uy/api/mesas/mxv", {
      headers: { Authorization: `Bearer ${TOKEN}` },
    }),
    "calas",
    {
      consumeRateLimit: async () => {
        throw unavailable("test_failure")
      },
    },
  )

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    error: "El servicio no está disponible en este momento.",
    code: "SERVICE_UNAVAILABLE",
  })
})
