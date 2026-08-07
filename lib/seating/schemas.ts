import { z } from "zod"
import { normalizeTableCode } from "@/lib/seating/normalize"

export const seatingTableSchema = z.object({
  id: z.string().uuid(),
  code: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(200),
  shape: z.enum(["circle", "rectangle"]),
  x: z.number().min(0).max(10000),
  y: z.number().min(0).max(10000),
  width: z.number().min(32).max(600),
  height: z.number().min(32).max(600),
  rotation: z.number().min(-360).max(360),
})

export const saveSeatingLayoutSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  floorPlan: z.object({
    logicalWidth: z.number().int().min(480).max(4000),
    logicalHeight: z.number().int().min(320).max(3000),
    backgroundPath: z.string().max(500).nullable(),
  }),
  tables: z.array(seatingTableSchema).max(300).superRefine((tables, ctx) => {
    const ids = new Set<string>()
    const codes = new Set<string>()
    tables.forEach((table, index) => {
      if (ids.has(table.id)) {
        ctx.addIssue({ code: "custom", path: [index, "id"], message: "ID de mesa duplicado" })
      }
      ids.add(table.id)
      const code = normalizeTableCode(table.code)
      if (codes.has(code)) {
        ctx.addIssue({ code: "custom", path: [index, "code"], message: "Código de mesa duplicado" })
      }
      codes.add(code)
    })
  }),
}).superRefine((layout, ctx) => {
  layout.tables.forEach((table, index) => {
    if (
      table.x - table.width / 2 < 0 ||
      table.x + table.width / 2 > layout.floorPlan.logicalWidth
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["tables", index, "x"],
        message: "La mesa queda fuera del ancho del plano",
      })
    }
    if (
      table.y - table.height / 2 < 0 ||
      table.y + table.height / 2 > layout.floorPlan.logicalHeight
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["tables", index, "y"],
        message: "La mesa queda fuera del alto del plano",
      })
    }
  })
})

export const assignGuestSchema = z.object({
  guestId: z.string().uuid(),
  tableId: z.string().uuid().nullable(),
  force: z.boolean().default(false),
})
