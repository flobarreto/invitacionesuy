import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import bcrypt from "bcryptjs"
import { hashSessionToken } from "@/lib/auth"
import {
  ADMIN_PASSWORD_BCRYPT_ROUNDS,
  INVALID_ADMIN_PASSWORD_HASH,
} from "@/lib/auth-password"
import { assertMutationRequest, RequestSecurityError } from "@/lib/security"

test("session tokens are persisted as a one-way SHA-256 hash", () => {
  const token = "opaque-test-token-with-enough-entropy"
  assert.equal(
    hashSessionToken(token),
    createHash("sha256").update(token, "utf8").digest("hex"),
  )
  assert.notEqual(hashSessionToken(token), token)
})

test("unknown admin login uses the same bcrypt cost as create-admin", () => {
  assert.equal(ADMIN_PASSWORD_BCRYPT_ROUNDS, 10)
  assert.equal(
    bcrypt.getRounds(INVALID_ADMIN_PASSWORD_HASH),
    ADMIN_PASSWORD_BCRYPT_ROUNDS,
  )
})

test("mutation security accepts the exact request origin", () => {
  const request = new Request("https://invitia.uy/api/admin/logout", {
    method: "POST",
    headers: { origin: "https://invitia.uy", "sec-fetch-site": "same-origin" },
  })
  assert.doesNotThrow(() => assertMutationRequest(request))
})

test("mutation security rejects missing and cross-site origins", () => {
  const missingOrigin = new Request("https://invitia.uy/api/admin/logout", {
    method: "POST",
  })
  const crossSite = new Request("https://invitia.uy/api/admin/logout", {
    method: "POST",
    headers: { origin: "https://example.com", "sec-fetch-site": "cross-site" },
  })

  assert.throws(
    () => assertMutationRequest(missingOrigin),
    RequestSecurityError,
  )
  assert.throws(
    () => assertMutationRequest(crossSite),
    RequestSecurityError,
  )
})

test("safe methods do not require an Origin header", () => {
  const request = new Request("https://invitia.uy/api/admin/events", {
    method: "GET",
  })
  assert.doesNotThrow(() => assertMutationRequest(request))
})
