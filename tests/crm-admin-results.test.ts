import assert from "node:assert/strict"
import test from "node:test"
import {
  createInvitationGroupResult,
  importGuestCsvResult,
} from "@/lib/crm/admin-results"

test("el alta CRM devuelve sólo el ID y estado de idempotencia", () => {
  const result = createInvitationGroupResult("group-1", false)
  assert.deepEqual(result, { groupId: "group-1", idempotentReplay: false })
  assert.equal("invitationToken" in result, false)
})

test("la importación CRM devuelve IDs y conteos sin tokens de RSVP", () => {
  const result = importGuestCsvResult(["group-1", "group-2"], 4, true)
  assert.deepEqual(result, {
    importedGroupIds: ["group-1", "group-2"],
    importedGroups: 2,
    importedGuests: 4,
    idempotentReplay: true,
  })
  assert.equal(JSON.stringify(result).includes("invitationToken"), false)
})
