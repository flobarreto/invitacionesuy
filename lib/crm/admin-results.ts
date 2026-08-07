export type CreateInvitationGroupResult = {
  groupId: string
  idempotentReplay: boolean
}

export type ImportGuestCsvResult = {
  importedGroupIds: string[]
  importedGroups: number
  importedGuests: number
  idempotentReplay: boolean
}

export function createInvitationGroupResult(
  groupId: string,
  idempotentReplay: boolean | undefined,
): CreateInvitationGroupResult {
  return { groupId, idempotentReplay: idempotentReplay ?? false }
}

export function importGuestCsvResult(
  importedGroupIds: string[],
  importedGuests: number,
  idempotentReplay: boolean | undefined,
): ImportGuestCsvResult {
  return {
    importedGroupIds,
    importedGroups: importedGroupIds.length,
    importedGuests,
    idempotentReplay: idempotentReplay ?? false,
  }
}
