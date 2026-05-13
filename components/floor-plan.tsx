"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Upload, Plus, X, Search, Save, Trash2, RefreshCw, Tag as TagIcon, Sun, ZoomIn, ZoomOut, User, Users } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Tag {
  id: string
  name: string
  color: string
}

interface RSVP {
  id?: string
  name: string
  attendance: string
  tags?: string[]
  table_number?: string | null
}

interface FloorTable {
  id: string
  /** Must match rsvp.table_number (stored uppercase) */
  tableNumber: string
  name: string
  /** Percentage (0–100) of canvas width */
  x: number
  /** Percentage (0–100) of canvas height */
  y: number
  maxPeople: number
  shape: "circle" | "rectangle"
  /** Circle: diameter. Rectangle: not used (use width/height instead) */
  size?: number
  /** Rectangle width in px (ignored for circles) */
  width?: number
  /** Rectangle height in px (ignored for circles) */
  height?: number
}

interface FloorPlanState {
  imageUrl: string | null
  opacity: number
  floorTables: FloorTable[]
}

interface DragState {
  tableId: string
  offsetXPct: number
  offsetYPct: number
  moved: boolean
}

// ─── Sunburst overlay ────────────────────────────────────────────────────────

function SunburstOverlay({
  show,
  canvasRef,
  floorTables,
  getRsvpsForTable,
}: {
  show: boolean
  canvasRef: React.RefObject<HTMLDivElement | null>
  floorTables: FloorTable[]
  getRsvpsForTable: (tableNumber: string) => RSVP[]
}) {
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [canvasRef])

  if (!show || size.w === 0) return null

  const labels: React.ReactNode[] = []

  for (const t of floorTables) {
    const people = getRsvpsForTable(t.tableNumber)
    if (people.length === 0) continue

    const cx = (t.x / 100) * size.w
    const cy = (t.y / 100) * size.h
    const isCircle = t.shape === "circle"
    const tableR = isCircle ? (t.size ?? 68) / 2 : 0
    const halfW = (t.width ?? 84) / 2
    const halfH = (t.height ?? 54) / 2

    people.forEach((person, i) => {
      const angle = (2 * Math.PI * i) / people.length - Math.PI / 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      // Start point: table edge + small gap
      let edgeDist: number
      if (isCircle) {
        edgeDist = tableR
      } else {
        edgeDist = Math.min(
          cos !== 0 ? halfW / Math.abs(cos) : Infinity,
          sin !== 0 ? halfH / Math.abs(sin) : Infinity
        )
      }

      const gap = 10
      const px = cx + (edgeDist + gap) * cos
      const py = cy + (edgeDist + gap) * sin

      // Rotate text along the ray; flip left-side labels so they're never upside-down
      const raw = (angle * 180) / Math.PI
      const flip = cos < -0.01
      const angleDeg = flip ? raw + 180 : raw
      const anchor = flip ? "end" : "start"

      labels.push(
        <text
          key={`${t.id}-${person.id ?? i}`}
          x={px}
          y={py}
          fontSize={12}
          fontWeight="600"
          fontFamily="inherit"
          textAnchor={anchor}
          dominantBaseline="middle"
          fill="currentColor"
          transform={`rotate(${angleDeg}, ${px}, ${py})`}
          style={{ userSelect: "none" }}
        >
          {person.name.split(" ")[0]}
        </text>
      )
    })
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none text-foreground"
      width={size.w}
      height={size.h}
    >
      {labels}
    </svg>
  )
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface FloorPlanProps {
  rsvps: RSVP[]
  availableTags: Tag[]
  onRsvpTableChange: (rsvpId: string, tableNumber: string | null) => Promise<void>
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FloorPlan({ rsvps, availableTags, onRsvpTableChange }: FloorPlanProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const planRef = useRef<FloorPlanState>({ imageUrl: null, opacity: 0.7, floorTables: [] })
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<{
    tableId: string
    type: "size" | "width" | "height"
    initialValue: number
    startX: number
    startY: number
  } | null>(null)

  const [plan, setPlan] = useState<FloorPlanState>({ imageUrl: null, opacity: 0.7, floorTables: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Edit dialog state
  const [dialogTableId, setDialogTableId] = useState<string | null>(null)
  const [editTable, setEditTable] = useState<FloorTable | null>(null)
  const [search, setSearch] = useState("")
  const [tagFilter, setTagFilter] = useState("")

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [newTable, setNewTable] = useState({ name: "", tableNumber: "", maxPeople: 8, shape: "circle" as "circle" | "rectangle" })

  // Zoom
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)

  // Visualization toggles
  const [showTags, setShowTags] = useState(false)
  const [showPersons, setShowPersons] = useState(false)

  // Keep refs in sync so drag handlers always read fresh values
  useEffect(() => { planRef.current = plan }, [plan])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  useEffect(() => {
    loadPlan()
  }, [])


  // ─── Data fetching ──────────────────────────────────────────────────────────

  const loadPlan = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/floor-plan")
      if (!res.ok) return
      const { floorPlan } = await res.json()
      const loaded: FloorPlanState = {
        imageUrl: floorPlan?.image_url ?? null,
        opacity: typeof floorPlan?.opacity === "number" ? floorPlan.opacity : 0.7,
        floorTables: Array.isArray(floorPlan?.floor_tables) ? floorPlan.floor_tables : [],
      }
      setPlan(loaded)
      planRef.current = loaded
    } catch (e) {
      console.error("Error loading floor plan:", e)
    } finally {
      setLoading(false)
    }
  }

  const save = useCallback(async (data: FloorPlanState) => {
    setSaving(true)
    try {
      await fetch("/api/admin/floor-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: data.imageUrl,
          opacity: data.opacity,
          floorTables: data.floorTables,
        }),
      })
    } catch (e) {
      console.error("Error saving floor plan:", e)
    } finally {
      setSaving(false)
    }
  }, [])

  // Helper: update state + ref atomically, optionally trigger save
  const applyUpdate = useCallback(
    (next: FloorPlanState, autoSave = false) => {
      setPlan(next)
      planRef.current = next
      if (autoSave) save(next)
    },
    [save]
  )

  // ─── Image upload ───────────────────────────────────────────────────────────

  const handleImageFile = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/floor-plan/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Error al subir la imagen")
        return
      }
      applyUpdate({ ...planRef.current, imageUrl: data.imageUrl }, true)
    } finally {
      setUploading(false)
    }
  }

  // ─── Add table ──────────────────────────────────────────────────────────────

  const handleAddTable = () => {
    setNewTable({ name: "", tableNumber: "", maxPeople: 8, shape: "circle" })
    setCreateOpen(true)
  }

  const handleCreateTable = () => {
    const raw = newTable.tableNumber.trim()
    if (!raw) return
    const tableNumber = raw.toUpperCase()
    const idx = planRef.current.floorTables.length
    const created: FloorTable = {
      id: crypto.randomUUID(),
      tableNumber,
      name: raw,
      x: 5 + (idx % 5) * 18,
      y: 5 + Math.floor(idx / 5) * 28,
      maxPeople: newTable.maxPeople,
      shape: newTable.shape,
    }
    applyUpdate({ ...planRef.current, floorTables: [...planRef.current.floorTables, created] }, true)
    setCreateOpen(false)
  }

  // RSVP table numbers that exist but don't have a floor table yet
  const unplacedTableNumbers = [...new Set(
    rsvps.map((r) => r.table_number).filter((tn): tn is string => Boolean(tn))
  )]
    .filter((tn) => !planRef.current.floorTables.some((t) => t.tableNumber === tn))
    .sort((a, b) => {
      const na = Number(a), nb = Number(b)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.localeCompare(b, "es")
    })

  // ─── Drag & drop ────────────────────────────────────────────────────────────

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, tableId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canvasRef.current) return

    e.currentTarget.setPointerCapture(e.pointerId)

    const rect = canvasRef.current.getBoundingClientRect()
    const t = planRef.current.floorTables.find((t) => t.id === tableId)
    if (!t) return

    dragRef.current = {
      tableId,
      offsetXPct: ((e.clientX - rect.left) / rect.width) * 100 - t.x,
      offsetYPct: ((e.clientY - rect.top) / rect.height) * 100 - t.y,
      moved: false,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>, tableId: string) => {
    if (!dragRef.current || dragRef.current.tableId !== tableId || !canvasRef.current) return
    e.preventDefault()

    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.max(2, Math.min(97, ((e.clientX - rect.left) / rect.width) * 100 - dragRef.current.offsetXPct))
    const y = Math.max(2, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100 - dragRef.current.offsetYPct))

    dragRef.current.moved = true

    // Only update position in state (not planRef) during drag for perf
    setPlan((prev) => ({
      ...prev,
      floorTables: prev.floorTables.map((t) => (t.id === tableId ? { ...t, x, y } : t)),
    }))
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>, tableId: string) => {
    const drag = dragRef.current
    dragRef.current = null

    if (drag?.moved) {
      // planRef might be slightly stale; schedule save after state flush
      setTimeout(() => save(planRef.current), 0)
    } else {
      // It was a click: open the edit dialog
      const t = planRef.current.floorTables.find((t) => t.id === tableId)
      if (t) {
        setEditTable({ ...t })
        setDialogTableId(tableId)
        setSearch("")
        setTagFilter("")
      }
    }
  }

  const onLostCapture = () => {
    if (dragRef.current?.moved) {
      setTimeout(() => save(planRef.current), 0)
    }
    dragRef.current = null
  }

  // ─── Resize handlers ────────────────────────────────────────────────────────

  const startResize = (
    e: React.PointerEvent<HTMLDivElement>,
    tableId: string,
    type: "size" | "width" | "height"
  ) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const t = planRef.current.floorTables.find((t) => t.id === tableId)
    if (!t) return
    const initialValue =
      type === "width" ? (t.width ?? 84) :
      type === "height" ? (t.height ?? 54) :
      (t.size ?? 68)
    resizeRef.current = { tableId, type, initialValue, startX: e.clientX, startY: e.clientY }
  }

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>, tableId: string) => {
    if (!resizeRef.current || resizeRef.current.tableId !== tableId) return
    e.preventDefault()
    const { type, initialValue, startX, startY } = resizeRef.current
    let newValue: number
    if (type === "width") {
      newValue = Math.round(Math.max(44, Math.min(400, initialValue + (e.clientX - startX))))
    } else if (type === "height") {
      newValue = Math.round(Math.max(44, Math.min(400, initialValue + (e.clientY - startY))))
    } else {
      const delta = (e.clientX - startX + e.clientY - startY) / 2
      newValue = Math.round(Math.max(44, Math.min(200, initialValue + delta)))
    }
    setPlan((prev) => ({
      ...prev,
      floorTables: prev.floorTables.map((t) => {
        if (t.id !== tableId) return t
        if (type === "width") return { ...t, width: newValue }
        if (type === "height") return { ...t, height: newValue }
        return { ...t, size: newValue }
      }),
    }))
  }

  const onResizePointerUp = () => {
    if (!resizeRef.current) return
    resizeRef.current = null
    setTimeout(() => save(planRef.current), 0)
  }

  // ─── Dialog actions ─────────────────────────────────────────────────────────

  const closeDialog = () => {
    setDialogTableId(null)
    setEditTable(null)
    setSearch("")
    setTagFilter("")
  }

  const handleSaveEdit = () => {
    if (!editTable) return
    const tableNumber = (editTable.tableNumber.trim() || editTable.name.trim()).toUpperCase()
    const saved: FloorTable = { ...editTable, tableNumber }
    applyUpdate(
      { ...planRef.current, floorTables: planRef.current.floorTables.map((t) => (t.id === saved.id ? saved : t)) },
      true
    )
    closeDialog()
  }

  const handleDeleteTable = async () => {
    if (!editTable) return
    if (!confirm(`¿Eliminar la mesa "${editTable.name}"? Las personas asignadas quedarán sin mesa.`)) return

    // Remove table assignments from RSVPs
    const assigned = rsvps.filter((r) => r.table_number === editTable.tableNumber && r.id)
    for (const r of assigned) {
      if (r.id) await onRsvpTableChange(r.id, null)
    }

    applyUpdate(
      { ...planRef.current, floorTables: planRef.current.floorTables.filter((t) => t.id !== editTable.id) },
      true
    )
    closeDialog()
  }

  const handleAssign = async (rsvpId: string) => {
    if (!editTable) return
    const count = rsvps.filter((r) => r.table_number === editTable.tableNumber).length
    if (count >= editTable.maxPeople) {
      alert(`La mesa "${editTable.name}" ya está completa (máximo ${editTable.maxPeople} personas).`)
      return
    }
    await onRsvpTableChange(rsvpId, editTable.tableNumber)
  }

  const handleUnassign = async (rsvpId: string) => {
    await onRsvpTableChange(rsvpId, null)
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const getTag = (id: string) => availableTags.find((t) => String(t.id) === String(id))

  const getRsvpsForTable = (tableNumber: string) =>
    rsvps.filter((r) => r.table_number === tableNumber)

  const assignedRsvps = editTable ? getRsvpsForTable(editTable.tableNumber) : []
  const isFull = editTable ? assignedRsvps.length >= editTable.maxPeople : false

  const availablePeople = rsvps.filter((r) => {
    if (!r.id || r.table_number) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    if (tagFilter && !(r.tags || []).some((tid) => String(tid) === tagFilter)) return false
    return true
  })

  const tableCapacityStyle = (t: FloorTable) => {
    const count = getRsvpsForTable(t.tableNumber).length
    if (count >= t.maxPeople) return "border-red-500 bg-red-50 dark:bg-red-950/40"
    if (count > 0) return "border-green-500 bg-green-50 dark:bg-green-950/40"
    return "border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700"
  }

  const tableCountStyle = (t: FloorTable) => {
    const count = getRsvpsForTable(t.tableNumber).length
    if (count >= t.maxPeople) return "text-red-600 dark:text-red-400"
    if (count > 0) return "text-green-600 dark:text-green-400"
    return "text-muted-foreground"
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Cargando plano...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-card border rounded-lg">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleImageFile(f)
            e.target.value = ""
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {plan.imageUrl ? "Cambiar plano" : "Subir plano"}
            </>
          )}
        </Button>

        <Button size="sm" onClick={handleAddTable}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar mesa
        </Button>

        <Button
          variant={showTags ? "default" : "outline"}
          size="sm"
          onClick={() => setShowTags((v) => !v)}
        >
          <TagIcon className="h-4 w-4 mr-2" />
          Ver etiquetas
        </Button>

        <Button
          variant={showPersons ? "default" : "outline"}
          size="sm"
          onClick={() => setShowPersons((v) => !v)}
        >
          <Users className="h-4 w-4 mr-2" />
          Ver personas
        </Button>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
            disabled={zoom <= 0.25}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            className="text-xs tabular-nums w-12 text-center text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setZoom(1)}
            title="Resetear zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {saving && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Save className="h-3 w-3" />
            Guardando...
          </span>
        )}
      </div>

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        className="relative w-full bg-muted border-2 border-dashed border-muted-foreground/25 rounded-lg overflow-hidden select-none"
        style={{ height: "clamp(400px, 62vh, 720px)" }}
      >
        {/* Floor plan image */}
        {plan.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={plan.imageUrl}
            alt="Plano del salón"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{ opacity: 0.1, transform: `scale(${zoom})`, transformOrigin: "center center" }}
            draggable={false}
          />
        )}

        {/* Empty state */}
        {!plan.imageUrl && plan.floorTables.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground pointer-events-none">
            <Upload className="h-14 w-14 opacity-15" />
            <p className="text-sm font-medium">Subí el plano del salón para comenzar</p>
            <p className="text-xs opacity-60">También podés agregar mesas sin plano</p>
          </div>
        )}

        {/* Floor tables */}
        {plan.floorTables.map((t) => {
          const count = getRsvpsForTable(t.tableNumber).length
          const isCircle = t.shape === "circle"
          const isSelected = dialogTableId === t.id
          const size = t.size ?? 68
          const w = isCircle ? size : (t.width ?? 84)
          const h = isCircle ? size : (t.height ?? 54)
          const fontSize = Math.min(w, h) < 56 ? 9 : Math.min(w, h) < 80 ? 11 : 12

          return (
            <div
              key={t.id}
              className={[
                "absolute flex flex-col items-center justify-center border-2 shadow-md",
                "cursor-grab active:cursor-grabbing hover:shadow-lg transition-shadow",
                isCircle ? "rounded-full" : "rounded-lg",
                tableCapacityStyle(t),
                isSelected ? "ring-2 ring-offset-1 ring-primary" : "",
              ].join(" ")}
              style={{
                left: `${t.x}%`,
                top: `${t.y}%`,
                width: w,
                height: h,
                transform: "translate(-50%, -50%)",
                touchAction: "none",
              }}
              onPointerDown={(e) => onPointerDown(e, t.id)}
              onPointerMove={(e) => onPointerMove(e, t.id)}
              onPointerUp={(e) => onPointerUp(e, t.id)}
              onLostPointerCapture={onLostCapture}
            >
              <span className="font-bold leading-tight text-center px-1 truncate max-w-full" style={{ fontSize }}>
                {t.name}
              </span>
              <span className={`font-semibold leading-tight ${tableCountStyle(t)}`} style={{ fontSize }}>
                {count}/{t.maxPeople}
              </span>

              {showTags && (() => {
                const uniqueTagIds = [...new Set(getRsvpsForTable(t.tableNumber).flatMap((r) => r.tags ?? []))]
                if (uniqueTagIds.length === 0) return null
                return (
                  <div className="flex flex-wrap gap-0.5 justify-center px-1 mt-1 max-w-full">
                    {uniqueTagIds.slice(0, 4).map((tid) => {
                      const tag = getTag(tid)
                      return tag ? (
                        <span
                          key={tid}
                          className="text-white leading-tight px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap"
                          style={{ backgroundColor: tag.color, fontSize: 9 }}
                        >
                          {tag.name}
                        </span>
                      ) : null
                    })}
                  </div>
                )
              })()}

              {isCircle ? (
                /* Circle: single corner handle */
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full bg-muted-foreground/40 hover:bg-primary border border-background cursor-se-resize z-10"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => startResize(e, t.id, "size")}
                  onPointerMove={(e) => onResizePointerMove(e, t.id)}
                  onPointerUp={onResizePointerUp}
                  onLostPointerCapture={onResizePointerUp}
                />
              ) : (
                <>
                  {/* Rectangle: right handle (width) */}
                  <div
                    className="absolute -right-1.5 w-3 h-5 rounded-sm bg-muted-foreground/40 hover:bg-primary border border-background cursor-ew-resize z-10"
                    style={{ top: "50%", transform: "translateY(-50%)", touchAction: "none" }}
                    onPointerDown={(e) => startResize(e, t.id, "width")}
                    onPointerMove={(e) => onResizePointerMove(e, t.id)}
                    onPointerUp={onResizePointerUp}
                    onLostPointerCapture={onResizePointerUp}
                  />
                  {/* Rectangle: bottom handle (height) */}
                  <div
                    className="absolute -bottom-1.5 h-3 w-5 rounded-sm bg-muted-foreground/40 hover:bg-primary border border-background cursor-ns-resize z-10"
                    style={{ left: "50%", transform: "translateX(-50%)", touchAction: "none" }}
                    onPointerDown={(e) => startResize(e, t.id, "height")}
                    onPointerMove={(e) => onResizePointerMove(e, t.id)}
                    onPointerUp={onResizePointerUp}
                    onLostPointerCapture={onResizePointerUp}
                  />
                </>
              )}
            </div>
          )
        })}
        {/* Sunburst overlay */}
        <SunburstOverlay
          show={showPersons}
          canvasRef={canvasRef}
          floorTables={plan.floorTables}
          getRsvpsForTable={getRsvpsForTable}
        />

      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 inline-block shrink-0" />
          Sin asignar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-green-500 bg-green-50 dark:bg-green-950/40 inline-block shrink-0" />
          Con personas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-red-500 bg-red-50 dark:bg-red-950/40 inline-block shrink-0" />
          Completa
        </span>
        <span className="opacity-50 ml-1">· Arrastrá las mesas para moverlas · Hacé clic para editar</span>
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva mesa</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Unplaced RSVP tables */}
            {unplacedTableNumbers.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Mesas ya existentes sin ubicación en el plano</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Hacé clic para vincularla al plano con sus personas ya asignadas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unplacedTableNumbers.map((tn) => {
                    const count = getRsvpsForTable(tn).length
                    return (
                      <button
                        key={tn}
                        className={`text-sm px-3 py-1.5 rounded-lg border-2 transition-colors hover:bg-accent ${
                          newTable.tableNumber === tn
                            ? "border-primary bg-primary/10 font-semibold"
                            : "border-muted-foreground/30"
                        }`}
                        onClick={() =>
                          setNewTable((prev) => ({
                            ...prev,
                            tableNumber: tn,
                            name: prev.name || `Mesa ${tn}`,
                          }))
                        }
                      >
                        {tn}
                        <span className="ml-1.5 text-xs text-muted-foreground">({count} personas)</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Nombre/Número</Label>
                  <Input
                    value={newTable.tableNumber}
                    onChange={(e) => setNewTable((prev) => ({ ...prev, tableNumber: e.target.value }))}
                    className="mt-1"
                    placeholder="Ej: 1, VIP, Familia..."
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-sm">Capacidad máxima</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={newTable.maxPeople}
                    onChange={(e) =>
                      setNewTable((prev) => ({ ...prev, maxPeople: Math.max(1, parseInt(e.target.value) || 1) }))
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm">Forma</Label>
                <div className="flex gap-2 mt-1.5">
                  <Button
                    variant={newTable.shape === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewTable((prev) => ({ ...prev, shape: "circle" }))}
                  >
                    ● Circular
                  </Button>
                  <Button
                    variant={newTable.shape === "rectangle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewTable((prev) => ({ ...prev, shape: "rectangle" }))}
                  >
                    ▬ Rectangular
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreateTable}
              disabled={!newTable.tableNumber.trim()}
            >
              Crear mesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={dialogTableId !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {editTable && (
            <>
              <DialogHeader>
                <DialogTitle>Editar mesa</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-1">
                {/* Name + capacity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Nombre para mostrar</Label>
                    <Input
                      value={editTable.name}
                      onChange={(e) => setEditTable((prev) => prev ? { ...prev, name: e.target.value } : null)}
                      className="mt-1"
                      placeholder="Mesa 1, VIP, Familia..."
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Capacidad máxima</Label>
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={editTable.maxPeople}
                      onChange={(e) =>
                        setEditTable((prev) =>
                          prev ? { ...prev, maxPeople: Math.max(1, parseInt(e.target.value) || 1) } : null
                        )
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Table number (identifier) */}
                <div>
                  <Label className="text-sm">Identificador de mesa</Label>
                  <Input
                    value={editTable.tableNumber}
                    onChange={(e) =>
                      setEditTable((prev) => prev ? { ...prev, tableNumber: e.target.value.toUpperCase() } : null)
                    }
                    className="mt-1"
                    placeholder="Ej: 1, VIP, A"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Debe coincidir con el número de mesa de los invitados ya asignados
                  </p>
                </div>

                {/* Shape */}
                <div>
                  <Label className="text-sm">Forma</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Button
                      variant={editTable.shape === "circle" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEditTable((prev) => prev ? { ...prev, shape: "circle" } : null)}
                    >
                      ● Circular
                    </Button>
                    <Button
                      variant={editTable.shape === "rectangle" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEditTable((prev) => prev ? { ...prev, shape: "rectangle" } : null)}
                    >
                      ▬ Rectangular
                    </Button>
                  </div>
                </div>

                {/* Assigned people */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">
                      Personas asignadas ({assignedRsvps.length}/{editTable.maxPeople})
                    </Label>
                    {isFull && (
                      <Badge variant="destructive" className="text-xs">
                        Mesa completa
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {assignedRsvps.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3 text-center">
                        Ninguna persona asignada aún
                      </p>
                    ) : (
                      assignedRsvps.map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-2 rounded border gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium truncate block">{r.name}</span>
                            {r.tags && r.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {r.tags.map((tid) => {
                                  const tag = getTag(tid)
                                  return tag ? (
                                    <Badge
                                      key={tid}
                                      style={{ backgroundColor: tag.color }}
                                      className="text-white text-xs border-0 h-4 px-1.5"
                                    >
                                      {tag.name}
                                    </Badge>
                                  ) : null
                                })}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => r.id && handleUnassign(r.id)}
                            title="Quitar de la mesa"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Add people */}
                <div>
                  <Label className="text-sm font-medium">
                    {isFull ? "Mesa completa — no se pueden agregar más personas" : "Agregar persona"}
                  </Label>

                  {!isFull && (
                    <div className="mt-2 space-y-2">
                      {/* Name search */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nombre..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>

                      {/* Tag filter */}
                      {availableTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <button
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              !tagFilter
                                ? "bg-primary text-primary-foreground border-primary"
                                : "hover:bg-accent"
                            }`}
                            onClick={() => setTagFilter("")}
                          >
                            Todas
                          </button>
                          {availableTags.map((tag) => (
                            <button
                              key={tag.id}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                tagFilter === String(tag.id)
                                  ? "text-white border-transparent"
                                  : "hover:bg-accent"
                              }`}
                              style={tagFilter === String(tag.id) ? { backgroundColor: tag.color } : {}}
                              onClick={() => setTagFilter(tagFilter === String(tag.id) ? "" : String(tag.id))}
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* People list */}
                      <div className="space-y-1 max-h-44 overflow-y-auto border rounded-md p-1">
                        {availablePeople.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            {search || tagFilter
                              ? "Sin resultados para esa búsqueda"
                              : "No hay personas sin mesa para asignar"}
                          </p>
                        ) : (
                          availablePeople.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer gap-2"
                              onClick={() => r.id && handleAssign(r.id)}
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-sm block truncate">{r.name}</span>
                                {r.tags && r.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {r.tags.slice(0, 4).map((tid) => {
                                      const tag = getTag(tid)
                                      return tag ? (
                                        <Badge
                                          key={tid}
                                          style={{ backgroundColor: tag.color }}
                                          className="text-white text-xs border-0 h-4 px-1.5"
                                        >
                                          {tag.name}
                                        </Badge>
                                      ) : null
                                    })}
                                  </div>
                                )}
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 px-2">
                                + Asignar
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteTable}
                  className="sm:mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Eliminar mesa
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={closeDialog}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    Guardar
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
