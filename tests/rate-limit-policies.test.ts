import assert from "node:assert/strict"
import test from "node:test"
import { CrmError } from "@/lib/crm/errors"
import {
  enforceAdminLoginRateLimits,
  enforcePublicRsvpRateLimit,
} from "@/lib/crm/rate-limit-policies"
import type { RateLimitInput } from "@/lib/crm/rate-limit"

const request = new Request("https://invitia.uy/api/test", {
  headers: { "x-forwarded-for": "203.0.113.10" },
})

test("login consume primero el bucket de IP y luego el de username", async () => {
  const calls: RateLimitInput[] = []

  await enforceAdminLoginRateLimits(request, "Novios", async (input) => {
    calls.push(input)
  })

  assert.deepEqual(
    calls.map(({ namespace, identifier }) => ({ namespace, identifier })),
    [
      { namespace: "admin_login_ip", identifier: undefined },
      { namespace: "admin_login_username", identifier: "novios" },
    ],
  )
})

test("login no crea un bucket de username cuando la IP ya está limitada", async () => {
  const calls: RateLimitInput[] = []
  const blocked = new Error("blocked")

  await assert.rejects(
    enforceAdminLoginRateLimits(request, "username-unico", async (input) => {
      calls.push(input)
      throw blocked
    }),
    blocked,
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0].namespace, "admin_login_ip")
})

test("RSVP desconocido se rechaza antes de consumir un bucket", async () => {
  const calls: RateLimitInput[] = []

  await assert.rejects(
    enforcePublicRsvpRateLimit(
      { request, slug: "slug-controlado-por-atacante", operation: "read" },
      async (input) => {
        calls.push(input)
      },
    ),
    (error: unknown) =>
      error instanceof CrmError &&
      error.code === "INVITATION_NOT_FOUND" &&
      error.status === 404,
  )

  assert.equal(calls.length, 0)
})

test("RSVP usa namespaces fijos y particiona por evento dentro del hash", async () => {
  const calls: RateLimitInput[] = []
  const consume = async (input: RateLimitInput) => {
    calls.push(input)
  }

  const firstEvent = await enforcePublicRsvpRateLimit(
    { request, slug: "calas", operation: "read" },
    consume,
  )
  const secondEvent = await enforcePublicRsvpRateLimit(
    { request, slug: "bodaDomi&Diego-hotel", operation: "write" },
    consume,
  )

  assert.equal(firstEvent, "calas")
  assert.equal(secondEvent, "domi-diego")
  assert.deepEqual(
    calls.map(({ namespace, scope, limit, windowSeconds }) => ({
      namespace,
      scope,
      limit,
      windowSeconds,
    })),
    [
      {
        namespace: "public_rsvp_read",
        scope: "calas",
        limit: 60,
        windowSeconds: 60,
      },
      {
        namespace: "public_rsvp_write",
        scope: "domi-diego",
        limit: 12,
        windowSeconds: 60,
      },
    ],
  )
})
