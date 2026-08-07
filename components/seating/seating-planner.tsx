"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Check,
  Download,
  ImagePlus,
  Loader2,
  Plus,
  Redo2,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  UserMinus,
  UserPlus,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { normalizeSearch, normalizeTableCode, sortTableCodes } from "@/lib/seating/normalize"
import type { EditableLayout, SeatingGuest, SeatingSnapshot, SeatingTable } from "@/lib/seating/types"

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict"

type DragState = {
  tableId: string
  pointerId: number
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  moved: boolean
  before: EditableLayout
}

const HISTORY_LIMIT = 50

function cloneLayout(layout: EditableLayout): EditableLayout {
  return {
    floorPlan: { ...layout.floorPlan },
    tables: layout.tables.map((table) => ({ ...table })),
  }
}

function tableDraft(table: SeatingTable) {
  return {
    code: table.code,
    label: table.label,
    capacity: String(table.capacity),
    shape: table.shape,
    width: String(table.width),
    height: String(table.height),
  }
}

async function parseJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>
}

export function SeatingPlanner({ eventId }: { eventId: string }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const revisionRef = useRef(0)
  const layoutVersionRef = useRef(0)
  const layoutRef = useRef<EditableLayout | null>(null)
  const savingRef = useRef(false)
  const queuedSaveRef = useRef<{
    layout: EditableLayout
    version: number
  } | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const manualZoomRef = useRef(false)

  const [layout, setLayoutState] = useState<EditableLayout | null>(null)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [guests, setGuests] = useState<SeatingGuest[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReturnType<typeof tableDraft> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [saveError, setSaveError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [zoom, setZoom] = useState(0.75)
  const [past, setPast] = useState<EditableLayout[]>([])
  const [future, setFuture] = useState<EditableLayout[]>([])
  const [query, setQuery] = useState("")
  const [includePending, setIncludePending] = useState(false)
  const [includeAssigned, setIncludeAssigned] = useState(false)
  const [showPeople, setShowPeople] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [assigningGuestId, setAssigningGuestId] = useState<string | null>(null)

  const setLayout = useCallback((next: EditableLayout) => {
    layoutRef.current = next
    setLayoutState(next)
  }, [])

  const commitLayout = useCallback((next: EditableLayout) => {
    const current = layoutRef.current
    if (current) {
      setPast((items) => [...items.slice(-(HISTORY_LIMIT - 1)), cloneLayout(current)])
    }
    setFuture([])
    layoutVersionRef.current += 1
    setLayout(next)
    setSaveState("dirty")
  }, [setLayout])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const response = await fetch(`/api/admin/events/${eventId}/seating`, { cache: "no-store" })
      const data = await parseJson(response)
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo cargar el plano")
      const snapshot = data as unknown as SeatingSnapshot
      const next: EditableLayout = {
        floorPlan: {
          logical_width: snapshot.floorPlan.logical_width,
          logical_height: snapshot.floorPlan.logical_height,
          background_path: snapshot.floorPlan.background_path,
        },
        tables: [...snapshot.tables].sort((a, b) => sortTableCodes(a.code, b.code)),
      }
      revisionRef.current = snapshot.floorPlan.revision
      layoutVersionRef.current = 0
      setLayout(next)
      setBackgroundUrl(snapshot.floorPlan.background_url)
      setGuests(snapshot.guests)
      setPast([])
      setFuture([])
      setSelectedTableId(null)
      setSaveState("idle")
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudo cargar el plano")
    } finally {
      setLoading(false)
    }
  }, [eventId, setLayout])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !layout) return
    const resize = () => {
      const available = Math.max(320, viewport.clientWidth - 24)
      if (!manualZoomRef.current) {
        setZoom(Math.min(1, Math.max(0.3, available / layout.floorPlan.logical_width)))
      }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [layout?.floorPlan.logical_width])

  const saveNow = useCallback(async (
    snapshot: EditableLayout,
    version = layoutVersionRef.current,
  ) => {
    if (savingRef.current) {
      queuedSaveRef.current = { layout: cloneLayout(snapshot), version }
      return
    }
    savingRef.current = true
    setSaveState("saving")
    setSaveError("")
    try {
      const response = await fetch(`/api/admin/events/${eventId}/seating`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: revisionRef.current,
          floorPlan: {
            logicalWidth: snapshot.floorPlan.logical_width,
            logicalHeight: snapshot.floorPlan.logical_height,
            backgroundPath: snapshot.floorPlan.background_path,
          },
          tables: snapshot.tables.map(({ event_id: _eventId, ...table }) => table),
        }),
      })
      const data = await parseJson(response)
      if (response.status === 409) {
        setSaveState("conflict")
        setSaveError(typeof data.error === "string" ? data.error : "El plano cambió en otra pestaña")
        queuedSaveRef.current = null
        return
      }
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo guardar")
      revisionRef.current = Number(data.revision)
      setSaveState(layoutVersionRef.current === version ? "saved" : "dirty")
    } catch (error) {
      setSaveState("error")
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar")
    } finally {
      savingRef.current = false
      const queued = queuedSaveRef.current
      queuedSaveRef.current = null
      if (queued) void saveNow(queued.layout, queued.version)
    }
  }, [eventId])

  useEffect(() => {
    if (!layout || saveState !== "dirty") return
    const timer = window.setTimeout(() => void saveNow(layout), 700)
    return () => window.clearTimeout(timer)
  }, [layout, saveNow, saveState])

  const selectedTable = layout?.tables.find((table) => table.id === selectedTableId) ?? null

  useEffect(() => {
    setDraft(selectedTable ? tableDraft(selectedTable) : null)
  }, [selectedTableId, selectedTable?.code, selectedTable?.capacity, selectedTable?.label, selectedTable?.shape])

  const occupantsByTable = useMemo(() => {
    const result = new Map<string, SeatingGuest[]>()
    for (const guest of guests) {
      if (!guest.table_id || guest.attendance_status === "declined") continue
      const current = result.get(guest.table_id) ?? []
      current.push(guest)
      result.set(guest.table_id, current)
    }
    return result
  }, [guests])

  const availableGuests = useMemo(() => {
    const normalizedQuery = normalizeSearch(query)
    return guests.filter((guest) => {
      if (guest.attendance_status === "declined") return false
      if (guest.attendance_status === "pending" && !includePending) return false
      if (!includeAssigned && guest.table_id) return false
      if (guest.table_id === selectedTableId) return false
      const haystack = normalizeSearch(`${guest.name} ${guest.tags.map((tag) => tag.name).join(" ")}`)
      return !normalizedQuery || haystack.includes(normalizedQuery)
    })
  }, [guests, includeAssigned, includePending, query, selectedTableId])

  const undo = () => {
    const previous = past.at(-1)
    const current = layoutRef.current
    if (!previous || !current) return
    setPast((items) => items.slice(0, -1))
    setFuture((items) => [cloneLayout(current), ...items].slice(0, HISTORY_LIMIT))
    layoutVersionRef.current += 1
    setLayout(cloneLayout(previous))
    setSaveState("dirty")
  }

  const redo = () => {
    const next = future[0]
    const current = layoutRef.current
    if (!next || !current) return
    setFuture((items) => items.slice(1))
    setPast((items) => [...items, cloneLayout(current)].slice(-HISTORY_LIMIT))
    layoutVersionRef.current += 1
    setLayout(cloneLayout(next))
    setSaveState("dirty")
  }

  const addTable = () => {
    if (!layout) return
    const numericCodes = layout.tables.map((table) => Number(table.code)).filter(Number.isFinite)
    const code = String((numericCodes.length ? Math.max(...numericCodes) : 0) + 1)
    const table: SeatingTable = {
      id: crypto.randomUUID(),
      event_id: eventId,
      code,
      label: `Mesa ${code}`,
      capacity: 8,
      shape: "circle",
      x: layout.floorPlan.logical_width / 2,
      y: layout.floorPlan.logical_height / 2,
      width: 90,
      height: 90,
      rotation: 0,
    }
    commitLayout({ ...layout, tables: [...layout.tables, table] })
    setSelectedTableId(table.id)
  }

  const saveDraft = () => {
    if (!layout || !selectedTable || !draft) return
    const code = normalizeTableCode(draft.code)
    if (!code) return
    if (layout.tables.some((table) => table.id !== selectedTable.id && normalizeTableCode(table.code) === code)) {
      setSaveError("Ya existe una mesa con ese código")
      return
    }
    const capacity = Math.min(200, Math.max(1, Number.parseInt(draft.capacity, 10) || 1))
    const occupants = occupantsByTable.get(selectedTable.id)?.length ?? 0
    if (
      capacity < occupants &&
      !window.confirm(`La mesa tiene ${occupants} personas y quedará con capacidad ${capacity}. ¿Continuar?`)
    ) return
    const width = Math.min(600, Math.max(32, Number.parseInt(draft.width, 10) || 90))
    const height = Math.min(600, Math.max(32, Number.parseInt(draft.height, 10) || 90))
    const updated: SeatingTable = {
      ...selectedTable,
      code,
      label: draft.label.trim() || `Mesa ${code}`,
      capacity,
      shape: draft.shape,
      width,
      height,
      x: Math.max(width / 2, Math.min(layout.floorPlan.logical_width - width / 2, selectedTable.x)),
      y: Math.max(height / 2, Math.min(layout.floorPlan.logical_height - height / 2, selectedTable.y)),
    }
    commitLayout({ ...layout, tables: layout.tables.map((table) => table.id === updated.id ? updated : table) })
  }

  const deleteTable = () => {
    if (!layout || !selectedTable) return
    const occupants = occupantsByTable.get(selectedTable.id)?.length ?? 0
    if (occupants > 0) {
      window.alert(`Mové o quitá las ${occupants} personas asignadas antes de eliminar la mesa.`)
      return
    }
    if (!window.confirm(`¿Eliminar ${selectedTable.label}?`)) return
    commitLayout({ ...layout, tables: layout.tables.filter((table) => table.id !== selectedTable.id) })
    setSelectedTableId(null)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>, table: SeatingTable) => {
    if (!layout) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      tableId: table.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: table.x,
      startY: table.y,
      moved: false,
      before: cloneLayout(layout),
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const current = layoutRef.current
    if (!drag || drag.pointerId !== event.pointerId || !current) return
    const dx = event.clientX - drag.startClientX
    const dy = event.clientY - drag.startClientY
    if (!drag.moved && Math.hypot(dx, dy) < 6) return
    drag.moved = true
    const table = current.tables.find((item) => item.id === drag.tableId)
    if (!table) return
    const x = Math.max(table.width / 2, Math.min(current.floorPlan.logical_width - table.width / 2, drag.startX + dx / zoom))
    const y = Math.max(table.height / 2, Math.min(current.floorPlan.logical_height - table.height / 2, drag.startY + dy / zoom))
    setLayout({ ...current, tables: current.tables.map((item) => item.id === table.id ? { ...item, x, y } : item) })
  }

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (drag.moved) {
      setPast((items) => [...items.slice(-(HISTORY_LIMIT - 1)), drag.before])
      setFuture([])
      layoutVersionRef.current += 1
      setSaveState("dirty")
    } else {
      setSelectedTableId(drag.tableId)
    }
  }

  const assignGuest = async (guest: SeatingGuest, tableId: string | null, force = false) => {
    setAssigningGuestId(guest.id)
    try {
      const response = await fetch(`/api/admin/events/${eventId}/seating/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: guest.id, tableId, force }),
      })
      const data = await parseJson(response)
      if (response.status === 409 && data.code === "TABLE_CAPACITY_EXCEEDED" && !force) {
        if (window.confirm("La mesa está completa. ¿Querés asignarlo igualmente?")) {
          await assignGuest(guest, tableId, true)
        }
        return
      }
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo asignar")
      setGuests((items) => items.map((item) => item.id === guest.id ? { ...item, table_id: tableId } : item))
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo asignar")
    } finally {
      setAssigningGuestId(null)
    }
  }

  const uploadBackground = async (file: File) => {
    setUploading(true)
    setSaveError("")
    try {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch(`/api/admin/events/${eventId}/seating/background`, { method: "POST", body })
      const data = await parseJson(response)
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo subir")
      const current = layoutRef.current
      if (!current) return
      setBackgroundUrl(typeof data.backgroundUrl === "string" ? data.backgroundUrl : null)
      commitLayout({
        ...current,
        floorPlan: { ...current.floorPlan, background_path: typeof data.backgroundPath === "string" ? data.backgroundPath : null },
      })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo subir")
    } finally {
      setUploading(false)
    }
  }

  const exportPng = async () => {
    if (!layout) return
    const canvas = document.createElement("canvas")
    canvas.width = layout.floorPlan.logical_width
    canvas.height = layout.floorPlan.logical_height
    const context = canvas.getContext("2d")
    if (!context) return
    context.fillStyle = "#f8fafc"
    context.fillRect(0, 0, canvas.width, canvas.height)
    if (backgroundUrl) {
      try {
        const image = new Image()
        image.crossOrigin = "anonymous"
        image.src = backgroundUrl
        await image.decode()
        const ratio = Math.min(canvas.width / image.width, canvas.height / image.height)
        const width = image.width * ratio
        const height = image.height * ratio
        context.globalAlpha = 0.5
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
        context.globalAlpha = 1
      } catch {
        setSaveError("El plano se exportó sin fondo porque la imagen no pudo cargarse")
      }
    }
    for (const table of layout.tables) {
      const occupants = occupantsByTable.get(table.id)?.length ?? 0
      context.save()
      context.translate(table.x, table.y)
      context.rotate((table.rotation * Math.PI) / 180)
      context.fillStyle = occupants >= table.capacity ? "#fee2e2" : occupants > 0 ? "#dcfce7" : "#ffffff"
      context.strokeStyle = occupants >= table.capacity ? "#ef4444" : occupants > 0 ? "#22c55e" : "#94a3b8"
      context.lineWidth = 3
      context.beginPath()
      if (table.shape === "circle") {
        context.ellipse(0, 0, table.width / 2, table.height / 2, 0, 0, Math.PI * 2)
      } else {
        context.rect(-table.width / 2, -table.height / 2, table.width, table.height)
      }
      context.fill()
      context.stroke()
      context.fillStyle = "#0f172a"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.font = "600 14px sans-serif"
      context.fillText(table.label, 0, -8)
      context.font = "12px sans-serif"
      context.fillText(`${occupants}/${table.capacity}`, 0, 11)
      context.restore()
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) return
    const anchor = document.createElement("a")
    anchor.href = URL.createObjectURL(blob)
    anchor.download = "plano-de-mesas.png"
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  if (loading) {
    return <div className="flex min-h-72 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Cargando plano…</div>
  }

  if (loadError || !layout) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p>{loadError || "No se pudo cargar el plano"}</p>
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button>
      </div>
    )
  }

  const assignedToSelected = selectedTable ? (occupantsByTable.get(selectedTable.id) ?? []) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <input
          ref={uploadRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void uploadBackground(file)
            event.target.value = ""
          }}
        />
        <Button size="sm" onClick={addTable}><Plus className="mr-2 h-4 w-4" />Mesa</Button>
        <Button size="sm" variant="outline" disabled={uploading} onClick={() => uploadRef.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          {backgroundUrl ? "Cambiar plano" : "Subir plano"}
        </Button>
        <Button size="icon" variant="outline" disabled={!past.length} onClick={undo} title="Deshacer"><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" disabled={!future.length} onClick={redo} title="Rehacer"><Redo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant={showPeople ? "default" : "outline"} onClick={() => setShowPeople((value) => !value)}><Users className="mr-2 h-4 w-4" />Personas</Button>
        <Button size="sm" variant={showTags ? "default" : "outline"} onClick={() => setShowTags((value) => !value)}>Etiquetas</Button>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => { manualZoomRef.current = true; setZoom((value) => Math.max(0.25, value - 0.1)) }}><ZoomOut className="h-4 w-4" /></Button>
          <button
            className="w-14 text-xs tabular-nums"
            title="Ajustar al ancho"
            onClick={() => {
              manualZoomRef.current = false
              const available = Math.max(320, (viewportRef.current?.clientWidth ?? layout.floorPlan.logical_width) - 24)
              setZoom(Math.min(1, Math.max(0.3, available / layout.floorPlan.logical_width)))
            }}
          >{Math.round(zoom * 100)}%</button>
          <Button size="icon" variant="outline" onClick={() => { manualZoomRef.current = true; setZoom((value) => Math.min(2, value + 0.1)) }}><ZoomIn className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" onClick={() => void exportPng()} title="Exportar PNG"><Download className="h-4 w-4" /></Button>
        </div>
        <div className="flex min-w-28 items-center justify-end gap-1 text-xs text-muted-foreground">
          {saveState === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando</>}
          {saveState === "saved" && <><Check className="h-3.5 w-3.5 text-green-600" />Guardado</>}
          {saveState === "dirty" && "Cambios pendientes"}
          {(saveState === "error" || saveState === "conflict") && <span className="text-destructive">Error</span>}
        </div>
      </div>

      {(saveError || saveState === "conflict") && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>{saveError}</span>
          {saveState === "conflict" ? (
            <Button size="sm" variant="outline" onClick={() => void load()}>Recargar</Button>
          ) : saveState === "error" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const current = layoutRef.current
                if (current) void saveNow(current, layoutVersionRef.current)
              }}
            >Reintentar</Button>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div ref={viewportRef} className="max-h-[72vh] min-h-[480px] overflow-auto rounded-xl border bg-muted/40 p-3">
          <div style={{ width: layout.floorPlan.logical_width * zoom, height: layout.floorPlan.logical_height * zoom }}>
            <div
              ref={canvasRef}
              className="relative origin-top-left overflow-hidden rounded-lg border bg-white shadow-sm"
              style={{
                width: layout.floorPlan.logical_width,
                height: layout.floorPlan.logical_height,
                transform: `scale(${zoom})`,
              }}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) setSelectedTableId(null)
              }}
            >
              {backgroundUrl && <img src={backgroundUrl} alt="Plano del salón" className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-50" draggable={false} />}
              {layout.tables.map((table) => {
                const occupants = occupantsByTable.get(table.id) ?? []
                const full = occupants.length >= table.capacity
                const selected = selectedTableId === table.id
                const uniqueTags = [...new Map(occupants.flatMap((guest) => guest.tags).map((tag) => [tag.id, tag])).values()]
                return (
                  <button
                    key={table.id}
                    type="button"
                    aria-label={`${table.label}, ${occupants.length} de ${table.capacity}`}
                    className={`absolute flex touch-none select-none flex-col items-center justify-center border-2 bg-white/95 p-1 text-center shadow-md ${table.shape === "circle" ? "rounded-full" : "rounded-lg"} ${full ? "border-red-500 bg-red-50/95" : occupants.length ? "border-green-500 bg-green-50/95" : "border-slate-300"} ${selected ? "ring-4 ring-primary/30" : ""}`}
                    style={{
                      left: table.x,
                      top: table.y,
                      width: table.width,
                      height: table.height,
                      transform: `translate(-50%, -50%) rotate(${table.rotation}deg)`,
                    }}
                    onPointerDown={(event) => onPointerDown(event, table)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => {
                      const drag = dragRef.current
                      dragRef.current = null
                      if (drag?.moved) setLayout(cloneLayout(drag.before))
                    }}
                  >
                    <span className="max-w-full truncate text-xs font-semibold">{table.label}</span>
                    <span className="text-[11px] text-muted-foreground">{occupants.length}/{table.capacity}</span>
                    {showPeople && occupants.length > 0 && <span className="mt-0.5 max-w-full truncate text-[9px]">{occupants.map((guest) => guest.name.split(" ")[0]).join(", ")}</span>}
                    {showTags && uniqueTags.length > 0 && <span className="mt-0.5 flex max-w-full gap-0.5 overflow-hidden">{uniqueTags.slice(0, 3).map((tag) => <i key={tag.id} className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} title={tag.name} />)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="rounded-xl border bg-card p-4">
          {!selectedTable || !draft ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Users className="mb-3 h-9 w-9 opacity-30" />
              Seleccioná una mesa para editarla o asignar invitados. Arrastrarla no abre el editor.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div><h2 className="font-semibold">{selectedTable.label}</h2><p className="text-xs text-muted-foreground">{assignedToSelected.length}/{selectedTable.capacity} lugares</p></div>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={deleteTable}><Trash2 className="h-4 w-4" /></Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><Label htmlFor="table-code">Código</Label><Input id="table-code" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} /></div>
                <div><Label htmlFor="table-capacity">Capacidad</Label><Input id="table-capacity" type="number" min={1} max={200} value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} /></div>
                <div className="col-span-2"><Label htmlFor="table-label">Nombre visible</Label><Input id="table-label" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></div>
                <div><Label htmlFor="table-width">Ancho</Label><Input id="table-width" type="number" min={32} max={600} value={draft.width} onChange={(event) => setDraft({ ...draft, width: event.target.value })} /></div>
                <div><Label htmlFor="table-height">Alto</Label><Input id="table-height" type="number" min={32} max={600} value={draft.height} onChange={(event) => setDraft({ ...draft, height: event.target.value })} /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={draft.shape === "circle" ? "default" : "outline"} onClick={() => setDraft({ ...draft, shape: "circle" })}>Circular</Button>
                <Button size="sm" variant={draft.shape === "rectangle" ? "default" : "outline"} onClick={() => setDraft({ ...draft, shape: "rectangle" })}>Rectangular</Button>
                <Button size="sm" className="ml-auto" onClick={saveDraft}>Aplicar</Button>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-medium">Personas asignadas</h3>
                {assignedToSelected.length === 0 ? <p className="text-xs text-muted-foreground">Todavía no hay personas en esta mesa.</p> : assignedToSelected.map((guest) => (
                  <div key={guest.id} className="flex items-center gap-2 rounded-md border p-2">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{guest.name}</p><div className="mt-1 flex flex-wrap gap-1">{guest.tags.map((tag) => <Badge key={tag.id} className="border-0 text-[10px] text-white" style={{ backgroundColor: tag.color }}>{tag.name}</Badge>)}</div></div>
                    <Button size="icon" variant="ghost" disabled={assigningGuestId === guest.id} onClick={() => void assignGuest(guest, null)} title="Quitar de la mesa"><UserMinus className="h-4 w-4" /></Button>
                  </div>
                ))}
              </section>

              <section className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">Agregar o mover persona</h3>
                <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre o etiqueta" className="pl-8" /></div>
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={includePending} onCheckedChange={(checked) => setIncludePending(checked === true)} />Incluir pendientes</label>
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={includeAssigned} onCheckedChange={(checked) => setIncludeAssigned(checked === true)} />Mostrar personas de otras mesas</label>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {availableGuests.length === 0 ? <p className="py-3 text-center text-xs text-muted-foreground">Sin resultados</p> : availableGuests.map((guest) => {
                    const currentTable = layout.tables.find((table) => table.id === guest.table_id)
                    return (
                      <button key={guest.id} type="button" disabled={assigningGuestId === guest.id} onClick={() => void assignGuest(guest, selectedTable.id)} className="flex w-full items-center gap-2 rounded-md border p-2 text-left hover:bg-accent disabled:opacity-50">
                        <div className="min-w-0 flex-1"><p className="truncate text-sm">{guest.name}</p><p className="text-[10px] text-muted-foreground">{guest.attendance_status === "pending" ? "Pendiente" : currentTable ? `Mover desde ${currentTable.label}` : "Confirmado"}</p></div>
                        {assigningGuestId === guest.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
