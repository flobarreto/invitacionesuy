export type AttendanceStatus = "pending" | "attending" | "declined"

export type SeatingTableShape = "circle" | "rectangle"

export interface SeatingTable {
  id: string
  event_id: string
  code: string
  label: string
  capacity: number
  shape: SeatingTableShape
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface SeatingGuest {
  id: string
  name: string
  attendance_status: AttendanceStatus
  table_id: string | null
  tags: Array<{ id: string; name: string; color: string }>
}

export interface FloorPlan {
  event_id: string
  logical_width: number
  logical_height: number
  background_path: string | null
  background_url: string | null
  revision: number
}

export interface SeatingSnapshot {
  floorPlan: FloorPlan
  tables: SeatingTable[]
  guests: SeatingGuest[]
}

export interface EditableLayout {
  floorPlan: Pick<FloorPlan, "logical_width" | "logical_height" | "background_path">
  tables: SeatingTable[]
}
