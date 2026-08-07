import { z } from "zod"

export const opaqueInvitationTokenSchema = z
  .string()
  .min(32)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/)

export const publicTableEventSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const publicTableAssignmentSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    table: z.string().trim().min(1).max(300).nullable(),
  })
  .strict()

export const publicTableLookupResponseSchema = z
  .object({
    assignments: z.array(publicTableAssignmentSchema).max(30),
  })
  .strict()

export type PublicTableAssignment = z.infer<
  typeof publicTableAssignmentSchema
>

export function invitationTokenFromAuthorization(
  authorization: string | null,
): string | null {
  if (!authorization?.startsWith("Bearer ")) return null

  const parsed = opaqueInvitationTokenSchema.safeParse(
    authorization.slice("Bearer ".length),
  )
  return parsed.success ? parsed.data : null
}
