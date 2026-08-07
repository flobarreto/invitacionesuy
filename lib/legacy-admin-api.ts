import { z, type ZodType } from "zod"

const DEFAULT_JSON_LIMIT_BYTES = 32 * 1024
const legacyIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/)
const boundedTextSchema = (max: number) => z.string().trim().min(1).max(max)
const boundedListSchema = z
  .array(boundedTextSchema(120))
  .max(30)
  .transform((values) => [...new Set(values)])

export const legacyAddRsvpSchema = z
  .object({
    name: boundedTextSchema(120),
    attendance: z.string().trim().max(30).optional().default(""),
    dietaryPreferences: boundedListSchema.optional().default([]),
    favoriteSong: z.string().trim().max(200).optional().default(""),
    drink: boundedListSchema.optional().default([]),
    isSaveTheDate: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.isSaveTheDate && !value.attendance) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La respuesta de asistencia es obligatoria.",
        path: ["attendance"],
      })
    }
  })

export const legacyTagCreateSchema = z
  .object({
    name: boundedTextSchema(50),
    color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
  })
  .strict()

export const legacyTagUpdateSchema = legacyTagCreateSchema.extend({
  id: legacyIdentifierSchema,
})

export const legacyRsvpTagsSchema = z
  .object({
    rsvpId: legacyIdentifierSchema,
    tagIds: z
      .array(legacyIdentifierSchema)
      .max(50)
      .transform((values) => [...new Set(values)]),
  })
  .strict()

export const legacyRsvpTableSchema = z
  .object({
    rsvpId: legacyIdentifierSchema,
    tableNumber: z.string().trim().max(30).nullable(),
  })
  .strict()

export type LegacyJsonResult<T> =
  | { success: true; data: T }
  | { success: false; status: 400 | 413; error: "Formato inválido" | "Solicitud demasiado grande" }

export async function parseLegacyJson<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes = DEFAULT_JSON_LIMIT_BYTES,
): Promise<LegacyJsonResult<T>> {
  const declaredLength = request.headers.get("content-length")
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    return { success: false, status: 413, error: "Solicitud demasiado grande" }
  }

  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { success: false, status: 413, error: "Solicitud demasiado grande" }
  }

  try {
    const parsed = schema.safeParse(JSON.parse(raw))
    return parsed.success
      ? { success: true, data: parsed.data }
      : { success: false, status: 400, error: "Formato inválido" }
  } catch {
    return { success: false, status: 400, error: "Formato inválido" }
  }
}

export function logLegacyDatabaseError(operation: string, error: unknown): void {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "unknown"
  console.error("Legacy admin database error", { operation, code })
}
