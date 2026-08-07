export const INVITATION_RENDERER_IDS = [
  "legacy-andres-lucre",
  "legacy-calas",
  "legacy-domi-diego",
  "legacy-mica-santi",
  "legacy-mica-tincho",
  "legacy-sofi-gonchi",
  "legacy-vir-jere",
  "preset-editorial",
] as const

export type InvitationRendererId =
  (typeof INVITATION_RENDERER_IDS)[number]

export type InvitationVariant = "default" | "hotel" | "editorial"

export type InvitationPublicationStatus = "draft" | "published"

export type RsvpLifecycleStatus = "scheduled" | "open" | "closed"

export type InvitationMetadata = {
  title: string
  description: string
  image?: string | null
}

export type InvitationEventConfig = {
  startsAt: string | null
  timezone: string
}

export type InvitationRsvpConfig = {
  enabled: boolean
  /** Runtime status comes from events.rsvp_status; static definitions may omit it. */
  status?: RsvpLifecycleStatus
  opensAt?: string | null
  closesAt: string | null
}

export type InvitationLegacyConfig = {
  /** Event key accepted by the pre-v2 RSVP route. */
  rsvpEventKey: string
  /** Existing Supabase table used while the unified data model rolls out. */
  rsvpTable: string
  /** Existing public paths kept alive while canonical URLs are adopted. */
  routes: string[]
}

export type InvitationCapabilities = {
  rsvp: boolean
  calendar: boolean
  tableSearch: boolean
}

export type InvitationCalendarConfig = {
  title: string
  durationMinutes: number
  details: string
  location?: string | null
}

export type InvitationDefinition = {
  id: string
  /** Stable config key. Database APIs must resolve this key/slug to events.id UUID. */
  eventKey: string
  slug: string
  aliases: string[]
  status: InvitationPublicationStatus
  renderer: InvitationRendererId
  variant?: InvitationVariant | null
  coupleNames: string
  metadata: InvitationMetadata
  event: InvitationEventConfig
  rsvp: InvitationRsvpConfig
  capabilities: InvitationCapabilities
  calendar: InvitationCalendarConfig
  assets: {
    basePath: string
    preview?: string | null
  }
  legacy: InvitationLegacyConfig
}

export type RsvpPayload = {
  name?: string
  attendance?: string
  dietaryPreferences?: string[]
  favoriteSong?: string
  email?: string
  drink?: string[]
  isSaveTheDate?: boolean
}

export type RsvpSubmissionFeedback = {
  type: "success" | "error"
  message: string
}
