/**
 * Floor Planner – Helpers: snap, uuid, clamp, etc.
 */

import type { TableNode, VenueLayout } from "./types"
import { DEFAULT_TABLE_STYLE, DEFAULT_ROUND_RADIUS, DEFAULT_RECT_WIDTH, DEFAULT_RECT_HEIGHT } from "./types"

/** Generate a simple UUID-like id */
export function uuid(): string {
  return "fp-" + Math.random().toString(36).slice(2, 11) + "-" + Date.now().toString(36)
}

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Snap value to grid (cell size in same units as stage) */
export function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value
  return Math.round(value / gridSize) * gridSize
}

/** Snap point (x, y) to grid */
export function snapPoint(x: number, y: number, gridSize: number): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  }
}

/** Create a new round table with defaults */
export function createRoundTable(overrides: Partial<TableNode> & { x: number; y: number }): TableNode {
  return {
    id: uuid(),
    name: "Mesa redonda",
    shape: "round",
    x: overrides.x,
    y: overrides.y,
    radius: DEFAULT_ROUND_RADIUS,
    rotation: 0,
    seats: 6,
    locked: false,
    style: { ...DEFAULT_TABLE_STYLE },
    ...overrides,
  }
}

/** Create a new rectangular table with defaults */
export function createRectTable(overrides: Partial<TableNode> & { x: number; y: number }): TableNode {
  return {
    id: uuid(),
    name: "Mesa rectangular",
    shape: "rect",
    x: overrides.x,
    y: overrides.y,
    width: DEFAULT_RECT_WIDTH,
    height: DEFAULT_RECT_HEIGHT,
    rotation: 0,
    seats: 6,
    locked: false,
    style: { ...DEFAULT_TABLE_STYLE },
    ...overrides,
  }
}

/** Duplicate a table (new id, slight offset) */
export function duplicateTable(table: TableNode): TableNode {
  const base = { ...table, id: uuid(), x: table.x + 20, y: table.y + 20 }
  if (base.style) base.style = { ...base.style }
  return base
}

/** Create empty layout for a venue */
export function createEmptyLayout(venueId: string, width: number, height: number): VenueLayout {
  return {
    venueId,
    width,
    height,
    tables: [],
  }
}

/** Parse layout from JSON string; returns null on error */
export function parseLayoutJson(json: string): VenueLayout | null {
  try {
    const data = JSON.parse(json) as VenueLayout
    if (typeof data.venueId !== "string" || typeof data.width !== "number" || typeof data.height !== "number") {
      return null
    }
    if (!Array.isArray(data.tables)) data.tables = []
    return data
  } catch {
    return null
  }
}
