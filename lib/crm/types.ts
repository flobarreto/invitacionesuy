export type AttendanceStatus = "pending" | "attending" | "declined"

export type CampaignKind =
  | "invitation"
  | "reminder"
  | "table_notice"
  | "table_correction"

export type DeliveryStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled"
  | "uncertain"

export type ConsentSource = "manual" | "csv" | "rsvp" | "legacy"

export interface InvitationGroup {
  id: string
  eventId: string
  displayName: string
  phoneE164: string | null
  consentAt: string | null
  consentSource: ConsentSource | null
  createdAt: string
  guests: Guest[]
  tags: GuestTag[]
}

export interface Guest {
  id: string
  eventId: string
  groupId: string
  name: string
  attendanceStatus: AttendanceStatus
  attendanceSource: "web" | "whatsapp" | "admin" | "legacy" | null
  tableId: string | null
  tableLabel?: string | null
  dietaryPreferences: string[]
  favoriteSong: string | null
  drinkPreferences: string[]
  createdAt: string
  updatedAt: string
}

export interface GuestTag {
  id: string
  eventId: string
  name: string
  color: string | null
}

export interface GuestImportInput {
  name: string
  phone: string
  labels?: string[]
  groupKey?: string
  consent?: boolean
}

export interface GuestImportIssue {
  code:
    | "missing_name"
    | "missing_phone"
    | "invalid_phone"
    | "duplicate_phone"
    | "duplicate_group_key"
    | "invalid_consent"
    | "inconsistent_consent"
    | "unknown_header"
  field?: string
  message: string
}

export interface GuestImportPreviewRow {
  rowNumber: number
  raw: Record<string, string>
  input: GuestImportInput | null
  issues: GuestImportIssue[]
}

export interface GuestImportPreview {
  rows: GuestImportPreviewRow[]
  validRows: number
  invalidRows: number
  duplicateRows: number
  groups: number
}

export interface CampaignPreviewGroup {
  groupId: string
  displayName: string
  phoneE164: string | null
  eligible: boolean
  reason:
    | "eligible"
    | "missing_phone"
    | "missing_consent"
    | "suppressed"
    | "no_pending_guests"
    | "no_attending_guests"
    | "missing_table"
    | "already_sent"
    | "not_stale"
  guests: Array<{
    id: string
    name: string
    attendanceStatus: AttendanceStatus
    tableLabel: string | null
  }>
}
