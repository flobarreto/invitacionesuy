import assert from "node:assert/strict"
import test from "node:test"
import {
  legacyAddRsvpSchema,
  legacyRsvpTagsSchema,
  legacyTagCreateSchema,
  logLegacyDatabaseError,
  parseLegacyJson,
} from "@/lib/legacy-admin-api"

test("las mutaciones legacy aplican límites y rechazan propiedades inesperadas", () => {
  assert.equal(legacyAddRsvpSchema.safeParse({ name: "Ana", attendance: "Sí" }).success, true)
  assert.equal(legacyAddRsvpSchema.safeParse({ name: "Ana", attendance: "" }).success, false)
  assert.equal(legacyAddRsvpSchema.safeParse({ name: "A".repeat(121), attendance: "Sí" }).success, false)
  assert.equal(legacyTagCreateSchema.safeParse({ name: "Familia", color: "red" }).success, false)
  assert.equal(
    legacyTagCreateSchema.safeParse({ name: "Familia", color: "#EF4444", eventId: "otro" }).success,
    false,
  )
})

test("normaliza y deduplica IDs de etiquetas con un máximo acotado", () => {
  const parsed = legacyRsvpTagsSchema.parse({ rsvpId: "123", tagIds: ["abc", "abc", "def"] })
  assert.deepEqual(parsed.tagIds, ["abc", "def"])
  assert.equal(
    legacyRsvpTagsSchema.safeParse({ rsvpId: "123", tagIds: Array.from({ length: 51 }, (_, index) => String(index)) }).success,
    false,
  )
})

test("parseLegacyJson limita el cuerpo antes y después de leerlo", async () => {
  const declaredTooLarge = await parseLegacyJson(
    new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-length": "40000" },
      body: JSON.stringify({ name: "Ana", attendance: "Sí" }),
    }),
    legacyAddRsvpSchema,
  )
  assert.deepEqual(declaredTooLarge, {
    success: false,
    status: 413,
    error: "Solicitud demasiado grande",
  })

  const actualTooLarge = await parseLegacyJson(
    new Request("https://example.test/api", {
      method: "POST",
      body: JSON.stringify({ name: "A".repeat(200), attendance: "Sí" }),
    }),
    legacyAddRsvpSchema,
    64,
  )
  assert.equal(actualTooLarge.success, false)
  if (!actualTooLarge.success) {
    assert.equal(actualTooLarge.status, 413)
  }
})

test("los logs legacy omiten mensaje, detalle, tabla y payload de PostgREST", () => {
  const originalError = console.error
  const entries: unknown[][] = []
  console.error = (...args: unknown[]) => entries.push(args)
  try {
    logLegacyDatabaseError("update_tags", {
      code: "PGRST116",
      message: "secret message",
      details: "private details",
      tableName: "private_table",
    })
  } finally {
    console.error = originalError
  }
  assert.deepEqual(entries, [["Legacy admin database error", { operation: "update_tags", code: "PGRST116" }]])
})
