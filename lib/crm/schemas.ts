import { z } from "zod"

export const attendanceStatusSchema = z.enum(["pending", "attending", "declined"])
export const campaignKindSchema = z.enum([
  "invitation",
  "reminder",
  "table_notice",
  "table_correction",
])

export const idempotencyKeySchema = z.string().trim().min(8).max(128)

export const manualGuestSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  groupName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(40),
  consent: z.boolean(),
  consentSource: z.literal("manual").default("manual"),
  labels: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  members: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        attendanceStatus: attendanceStatusSchema.default("pending"),
      }),
    )
    .min(1)
    .max(30),
})

export const csvPreviewPayloadSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
  defaultCallingCode: z.string().regex(/^\d{1,4}$/).default("598"),
})

export const csvPayloadSchema = csvPreviewPayloadSchema.extend({
  idempotencyKey: idempotencyKeySchema,
})

export const campaignPreviewSchema = z.object({
  kind: campaignKindSchema,
  groupIds: z.array(z.string().uuid()).max(10_000).optional(),
  customMessage: z.string().trim().max(1_500).optional(),
})

export const createCampaignSchema = campaignPreviewSchema.extend({
  idempotencyKey: idempotencyKeySchema,
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  confirmedPreviewHash: z.string().length(64),
})

export const publicRsvpSchema = z.object({
  token: z.string().min(32).max(256),
  responses: z
    .array(
      z.object({
        guestId: z.string().uuid(),
        attendanceStatus: z.enum(["attending", "declined"]),
        dietaryPreferences: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
        favoriteSong: z.string().trim().max(200).optional(),
        drinkPreferences: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      }),
    )
    .min(1)
    .max(30)
    .superRefine((responses, context) => {
      const seen = new Set<string>()
      responses.forEach((response, index) => {
        if (seen.has(response.guestId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Cada invitado puede aparecer una sola vez.",
            path: [index, "guestId"],
          })
        }
        seen.add(response.guestId)
      })
    }),
})

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const messagingSettingsSchema = z.object({
  messagingEnabled: z.boolean(),
  reminder: z.object({
    enabled: z.boolean(),
    daysBefore: z.number().int().min(0).max(365),
    time: localTimeSchema,
  }),
  tableNotice: z.object({
    enabled: z.boolean(),
    daysBefore: z.number().int().min(0).max(30),
    time: localTimeSchema,
    message: z.string().trim().max(1500).nullable(),
  }),
})
