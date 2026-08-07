import { z } from "zod"

const legacyRowIdSchema = z.union([
  z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  z.number().int().safe(),
])

export const legacyRsvpDeleteSchema = z
  .object({ id: legacyRowIdSchema })
  .strict()

