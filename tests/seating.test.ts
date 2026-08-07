import assert from "node:assert/strict"
import test from "node:test"
import {
  buildFloorPlanBackgroundPath,
  isCanonicalFloorPlanBackgroundPath,
} from "@/lib/seating/background-path"
import { normalizeSearch, normalizeTableCode, sortTableCodes } from "@/lib/seating/normalize"
import { saveSeatingLayoutSchema } from "@/lib/seating/schemas"

const eventId = "70000000-0000-4000-8000-000000000001"
const assetId = "80000000-0000-4000-8000-000000000001"

test("floor-plan background paths use one canonical event-owned storage key", () => {
  const backgroundPath = buildFloorPlanBackgroundPath(eventId, assetId, "png")

  assert.equal(backgroundPath, `${eventId}/${assetId}.png`)
  assert.equal(isCanonicalFloorPlanBackgroundPath(eventId, backgroundPath), true)
  assert.equal(
    isCanonicalFloorPlanBackgroundPath(eventId.toUpperCase(), backgroundPath),
    true,
  )
})

test("floor-plan background paths reject traversal and non-canonical keys", () => {
  const otherEventId = "70000000-0000-4000-8000-000000000002"
  const invalidPaths = [
    `${eventId}/../${otherEventId}/${assetId}.png`,
    `${eventId}/%2e%2e%2f${otherEventId}%2f${assetId}.png`,
    `${eventId}\\..\\${otherEventId}\\${assetId}.png`,
    `${eventId}//${assetId}.png`,
    `${eventId}/${assetId}.png/extra`,
    `${otherEventId}/${assetId}.png`,
    `${eventId}/plano.png`,
    `${eventId}/${assetId}.svg`,
    `${eventId}/${assetId}.png\n`,
    `https://example.invalid/${eventId}/${assetId}.png`,
    "",
  ]

  for (const backgroundPath of invalidPaths) {
    assert.equal(
      isCanonicalFloorPlanBackgroundPath(eventId, backgroundPath),
      false,
      backgroundPath,
    )
  }
})

test("seating search ignores accents, case and repeated whitespace", () => {
  assert.equal(normalizeSearch("  María   José  "), "maria jose")
  assert.equal(normalizeSearch("ÁÉÍÓÚ Ñ"), "aeiou n")
})

test("table codes are normalized and sorted naturally", () => {
  assert.equal(normalizeTableCode(" mesa   12 "), "MESA 12")
  assert.deepEqual(["Mesa 10", "Mesa 2", "A"].sort(sortTableCodes), ["A", "Mesa 2", "Mesa 10"])
})

test("a seating layout rejects duplicate table ids and codes", () => {
  const repeatedId = "00000000-0000-4000-8000-000000000001"
  const result = saveSeatingLayoutSchema.safeParse({
    expectedRevision: 0,
    floorPlan: {
      logicalWidth: 1200,
      logicalHeight: 700,
      backgroundPath: null,
    },
    tables: [
      {
        id: repeatedId,
        code: "Mesa 1",
        label: "Mesa 1",
        capacity: 10,
        shape: "circle",
        x: 20,
        y: 20,
        width: 96,
        height: 96,
        rotation: 0,
      },
      {
        id: repeatedId,
        code: "mesa 1",
        label: "Otra mesa",
        capacity: 8,
        shape: "rectangle",
        x: 200,
        y: 20,
        width: 120,
        height: 80,
        rotation: 0,
      },
    ],
  })

  assert.equal(result.success, false)
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message)
    assert.ok(messages.includes("ID de mesa duplicado"))
    assert.ok(messages.includes("Código de mesa duplicado"))
  }
})
