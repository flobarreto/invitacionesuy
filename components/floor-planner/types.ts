/**
 * Floor Planner – Data model and types.
 * Persistencia real: guardar VenueLayout en DB por venueId/eventId (ej: Supabase,
 * API POST/GET /api/venues/[venueId]/layout o /api/events/[eventId]/floor-plan).
 */

export type TableShape = "round" | "rect"

export type ScaleMode = "contain" | "cover" | "stretch"

export interface TableStyle {
  fill: string
  stroke: string
  strokeWidth: number
  textColor: string
}

export interface TableNode {
  id: string
  name: string
  shape: TableShape
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  rotation: number
  seats: number
  locked?: boolean
  style?: TableStyle
}

export interface BackgroundConfig {
  url: string
  opacity: number
  scaleMode: ScaleMode
}

export interface VenueLayout {
  venueId: string
  width: number
  height: number
  background?: BackgroundConfig
  tables: TableNode[]
}

/** Default style for a new table */
export const DEFAULT_TABLE_STYLE: TableStyle = {
  fill: "#f0f4f8",
  stroke: "#64748b",
  strokeWidth: 2,
  textColor: "#1e293b",
}

/** Default dimensions */
export const DEFAULT_ROUND_RADIUS = 40
export const DEFAULT_RECT_WIDTH = 120
export const DEFAULT_RECT_HEIGHT = 60
