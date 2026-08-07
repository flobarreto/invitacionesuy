import { z } from "zod"
import { INVITATION_RENDERER_IDS } from "./types"

const offsetDateTime = z.string().datetime({ offset: true })

export const invitationDefinitionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    eventKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    aliases: z.array(z.string().min(1)),
    status: z.enum(["draft", "published"]),
    renderer: z.enum(INVITATION_RENDERER_IDS),
    variant: z.enum(["default", "hotel", "editorial"]).nullable().optional(),
    coupleNames: z.string().min(1),
    metadata: z.object({
      title: z.string().min(1),
      description: z.string(),
      image: z.string().startsWith("/").nullable().optional(),
    }),
    event: z.object({
      startsAt: offsetDateTime.nullable(),
      timezone: z.string().min(1),
    }),
    rsvp: z.object({
      enabled: z.boolean(),
      status: z.enum(["scheduled", "open", "closed"]).optional(),
      opensAt: offsetDateTime.nullable().optional(),
      closesAt: offsetDateTime.nullable(),
    }),
    capabilities: z.object({
      rsvp: z.boolean(),
      calendar: z.boolean(),
      tableSearch: z.boolean(),
    }),
    calendar: z.object({
      title: z.string().trim().min(1).max(160),
      durationMinutes: z.number().int().min(15).max(1440),
      details: z.string().max(1000),
      location: z.string().trim().max(300).nullable().optional(),
    }),
    assets: z.object({
      basePath: z.string().startsWith("/"),
      preview: z.string().startsWith("/").nullable().optional(),
    }),
    legacy: z.object({
      rsvpEventKey: z.string().min(1),
      rsvpTable: z.string().regex(/^[a-z][a-z0-9_]*$/),
      routes: z.array(z.string().startsWith("/")),
    }),
  })
  .superRefine((definition, context) => {
    if (
      definition.renderer === "legacy-domi-diego" &&
      definition.variant !== "default" &&
      definition.variant !== "hotel"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variant"],
        message: "Domi & Diego necesita la variante default u hotel.",
      })
    }

    if (
      definition.renderer === "preset-editorial" &&
      definition.variant !== "editorial"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variant"],
        message: "El preset editorial necesita la variante editorial.",
      })
    }

    if (definition.status === "published" && !definition.event.startsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["event", "startsAt"],
        message: "Una invitación publicada necesita fecha de inicio.",
      })
    }

    if (definition.status === "published" && definition.rsvp.enabled) {
      if (!definition.rsvp.closesAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rsvp", "closesAt"],
          message: "Un RSVP publicado necesita fecha de cierre.",
        })
      }

      const startsAt = Date.parse(definition.event.startsAt ?? "")
      const closesAt = Date.parse(definition.rsvp.closesAt ?? "")
      const opensAt = Date.parse(definition.rsvp.opensAt ?? "")

      if (Number.isFinite(startsAt) && Number.isFinite(closesAt) && closesAt > startsAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rsvp", "closesAt"],
          message: "El RSVP no puede cerrar después del evento.",
        })
      }
      if (Number.isFinite(opensAt) && Number.isFinite(closesAt) && opensAt >= closesAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rsvp", "opensAt"],
          message: "La apertura del RSVP debe ser anterior al cierre.",
        })
      }
    }

    if (definition.capabilities.rsvp !== definition.rsvp.enabled) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capabilities", "rsvp"],
        message: "La capacidad RSVP y su configuración deben coincidir.",
      })
    }

    if (definition.capabilities.calendar && !definition.event.startsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capabilities", "calendar"],
        message: "Una invitación con calendario necesita fecha de evento.",
      })
    }
  })

export const invitationConfigSchema = z.array(invitationDefinitionSchema).min(1)
