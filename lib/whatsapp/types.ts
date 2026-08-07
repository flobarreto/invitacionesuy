import type { AttendanceStatus, CampaignKind, DeliveryStatus } from "@/lib/crm/types"

export type { AttendanceStatus, CampaignKind, DeliveryStatus }

export type CampaignStatus =
  | "draft"
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"

export interface MessageCampaign {
  id: string
  eventId: string
  kind: CampaignKind
  status: CampaignStatus
  scheduledFor: string
  customMessage: string | null
  idempotencyKey: string
  previewHash: string
  createdAt: string
}

export interface MessageDelivery {
  id: string
  campaignId: string
  eventId: string
  groupId: string
  kind: CampaignKind
  status: DeliveryStatus
  attemptCount: number
  nextAttemptAt: string
  customMessage: string | null
  payload: Record<string, unknown>
}

export type WhatsAppOutboundAction =
  | "ask_attendance"
  | "ask_change_selection"
  | "send_summary"
  | "invalid_prompt"
  | "review_notice"
  | "opt_out_confirmation"

export interface WhatsAppOutboundJob {
  id: string
  eventId: string | null
  groupId: string | null
  conversationId: string | null
  action: WhatsAppOutboundAction
  guestId: string | null
  recipientPhoneE164: string
  status: DeliveryStatus
  attemptCount: number
  nextAttemptAt: string
}

export interface WhatsAppOutboundContext extends WhatsAppOutboundJob {
  event: {
    slug: string
    displayName: string
    eventAt: string | null
    messagingEnabled: boolean
  } | null
  group: {
    displayName: string
    consentAt: string | null
    invitationToken: string
  } | null
  guests: Array<{
    id: string
    name: string
    attendanceStatus: AttendanceStatus
  }>
}

export interface DeliveryContext extends MessageDelivery {
  event: {
    slug: string
    displayName: string
    eventAt: string | null
    timezone: string
    messagingEnabled: boolean
    tableNoticeMessage: string | null
  }
  group: {
    displayName: string
    phoneE164: string
    consentAt: string | null
    invitationToken: string
  }
  guests: Array<{
    id: string
    name: string
    attendanceStatus: AttendanceStatus
    tableLabel: string | null
  }>
}

export interface ProviderInboundMessage {
  id: string
  from: string
  text: string
  quotedMessageId: string | null
  receivedAt: Date
}

export interface ProviderMessageStatus {
  id: string
  status: "sent" | "delivered" | "read" | "failed"
  occurredAt: Date
}

export interface ProviderSendResult {
  id: string
  acceptedAt: Date
}

export interface MessagingProvider {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  sendText(phoneE164: string, text: string): Promise<ProviderSendResult>
  onInbound(handler: (message: ProviderInboundMessage) => Promise<void>): void
  onStatus(handler: (status: ProviderMessageStatus) => Promise<void>): void
}
