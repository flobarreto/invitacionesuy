"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import { Stage, Layer, Group, Circle, Rect, Text, Image as KonvaImage, Transformer } from "react-konva"
import Konva from "konva"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Toolbar } from "./Toolbar"
import { PropertiesPanel } from "./PropertiesPanel"
import type { VenueLayout, TableNode, BackgroundConfig, ScaleMode } from "./types"
import {
  createEmptyLayout,
  createRoundTable,
  createRectTable,
  duplicateTable,
  parseLayoutJson,
  snapPoint,
  clamp,
} from "./utils"
import { DEFAULT_ROUND_RADIUS } from "./types"

const GRID_SIZE = 20
const HISTORY_MAX = 50
const DEFAULT_STAGE_WIDTH = 1200
const DEFAULT_STAGE_HEIGHT = 800

export interface FloorPlannerProps {
  venueId?: string
  initialLayout?: VenueLayout | null
  stageWidth?: number
  stageHeight?: number
  /** Cuando true, usa altura del contenedor en lugar del viewport (ej. dentro de un tab) */
  embedded?: boolean
  /** Si true, carga el plano desde /api/admin/floor-plan y muestra botón Guardar para persistir en la DB */
  useAdminApi?: boolean
}

export function FloorPlanner({
  venueId = "default",
  initialLayout = null,
  stageWidth = DEFAULT_STAGE_WIDTH,
  stageHeight = DEFAULT_STAGE_HEIGHT,
  embedded = false,
  useAdminApi = false,
}: FloorPlannerProps) {
  // Client-only: el componente se carga con dynamic(ssr:false), así que mounted puede ser true desde el inicio
  const [mounted, setMounted] = useState(true)
  const [layoutLoaded, setLayoutLoaded] = useState(!useAdminApi)
  const [savingToServer, setSavingToServer] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [layout, setLayout] = useState<VenueLayout>(() =>
    initialLayout ?? createEmptyLayout(venueId, 800, 600)
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Cargar plano desde la API en cuanto se monta (no esperar a "mounted" de Konva)
  useEffect(() => {
    if (!useAdminApi) return
    let cancelled = false
    const done = () => {
      if (!cancelled) setLayoutLoaded(true)
    }
    const load = async () => {
      try {
        const res = await fetch("/api/admin/floor-plan", { credentials: "include" })
        if (cancelled) return
        // Salir del loading en cuanto tengamos respuesta (200 o no)
        done()
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data.layout && typeof data.layout === "object") {
          const l = data.layout as VenueLayout
          if (Array.isArray(l.tables) && typeof l.width === "number" && typeof l.height === "number") {
            setLayout({
              venueId: l.venueId || venueId,
              width: l.width,
              height: l.height,
              background: l.background,
              tables: l.tables ?? [],
            })
            if (l.background) setBackgroundConfig(l.background)
          }
        }
      } catch {
        done()
      }
    }
    load()
    // Respaldo: si no hay respuesta en 3s, mostrar plano igual
    const timeout = setTimeout(done, 3000)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [useAdminApi, venueId])
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig | undefined>(
    layout.background
  )
  const [loadJsonOpen, setLoadJsonOpen] = useState(false)
  const [loadJsonValue, setLoadJsonValue] = useState("")
  const [loadJsonError, setLoadJsonError] = useState("")
  const [backgroundDialogOpen, setBackgroundDialogOpen] = useState(false)
  const [bgUrl, setBgUrl] = useState("")
  const [bgOpacity, setBgOpacity] = useState(0.8)
  const [bgScaleMode, setBgScaleMode] = useState<ScaleMode>("contain")
  const [undoStackLength, setUndoStackLength] = useState(0)
  const [redoStackLength, setRedoStackLength] = useState(0)

  const stageRef = useRef<Konva.Stage>(null)
  const zoomGroupRef = useRef<Konva.Group>(null)
  const tableNodeRefs = useRef<Map<string, Konva.Group>>(new Map())
  const historyRef = useRef<VenueLayout[]>([])
  const redoRef = useRef<VenueLayout[]>([])
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)

  const pushHistory = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-(HISTORY_MAX - 1)), JSON.parse(JSON.stringify(layout))]
    redoRef.current = []
    setUndoStackLength(historyRef.current.length)
    setRedoStackLength(0)
  }, [layout])

  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (prev) {
      redoRef.current = [...redoRef.current, layout]
      setLayout(prev)
      setSelectedId(null)
      setUndoStackLength(historyRef.current.length)
      setRedoStackLength(redoRef.current.length)
    }
  }, [layout])

  const redo = useCallback(() => {
    const next = redoRef.current.pop()
    if (next) {
      historyRef.current = [...historyRef.current, layout]
      setLayout(next)
      setSelectedId(null)
      setUndoStackLength(historyRef.current.length)
      setRedoStackLength(redoRef.current.length)
    }
  }, [layout])

  useEffect(() => {
    const isEditingInput = () => {
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName.toLowerCase()
      const role = el.getAttribute?.("role")
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.getAttribute?.("contenteditable") === "true" ||
        role === "combobox" ||
        role === "listbox"
      )
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(true)
      // No aplicar atajos cuando se está editando en el panel de propiedades
      if (isEditingInput()) return

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && !e.repeat) {
          e.preventDefault()
          setLayout((prev) => ({
            ...prev,
            tables: prev.tables.filter((t) => t.id !== selectedId),
          }))
          pushHistory()
          setSelectedId(null)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault()
        if (selectedId) {
          const table = layout.tables.find((t) => t.id === selectedId)
          if (table) {
            const dup = duplicateTable(table)
            setLayout((prev) => ({ ...prev, tables: [...prev.tables, dup] }))
            setSelectedId(dup.id)
            pushHistory()
          }
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceDown(false)
        setIsPanning(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [selectedId, layout, undo, redo, pushHistory])

  const updateTable = useCallback((id: string, updates: Partial<TableNode>) => {
    setLayout((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
  }, [])

  const handleStageWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return
      const oldScale = scale
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const scaleBy = 1.1
      const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy
      const clampedScale = clamp(newScale, 0.2, 5)
      const mousePointTo = {
        x: (pointer.x - pan.x) / oldScale,
        y: (pointer.y - pan.y) / oldScale,
      }
      const newPan = {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      }
      setPan(newPan)
      setScale(clampedScale)
    },
    [scale, pan]
  )

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Solo deseleccionar al hacer clic en el fondo del stage (no en una mesa ni en el grupo de zoom)
      const stage = e.target.getStage()
      const isClickOnEmptyStage = e.target === stage
      if (isClickOnEmptyStage) {
        if (spaceDown || e.evt.button === 1) {
          setIsPanning(true)
          dragStartPosRef.current = { x: e.evt.clientX - pan.x, y: e.evt.clientY - pan.y }
        } else {
          setSelectedId(null)
        }
      }
    },
    [spaceDown, pan]
  )

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return
      const pos = stage.getPointerPosition()
      if (pos) {
        const zoomGroup = zoomGroupRef.current
        if (!zoomGroup) return
        const transform = zoomGroup.getAbsoluteTransform()
        const inv = transform.copy().invert()
        const logical = inv.point({ x: pos.x, y: pos.y })
        setPointer({ x: Math.round(logical.x), y: Math.round(logical.y) })
      }
      if (isPanning && dragStartPosRef.current) {
        setPan({
          x: e.evt.clientX - dragStartPosRef.current.x,
          y: e.evt.clientY - dragStartPosRef.current.y,
        })
      }
    },
    [isPanning]
  )

  const handleStageMouseUp = useCallback(() => {
    setIsPanning(false)
    dragStartPosRef.current = null
  }, [])

  const addRoundTable = useCallback(() => {
    const centerX = layout.width / 2
    const centerY = layout.height / 2
    const table = createRoundTable({ x: centerX - DEFAULT_ROUND_RADIUS, y: centerY - DEFAULT_ROUND_RADIUS })
    setLayout((prev) => ({ ...prev, tables: [...prev.tables, table] }))
    setSelectedId(table.id)
    pushHistory()
  }, [layout, pushHistory])

  const addRectTable = useCallback(() => {
    const centerX = layout.width / 2
    const centerY = layout.height / 2
    const table = createRectTable({ x: centerX - 60, y: centerY - 30 })
    setLayout((prev) => ({ ...prev, tables: [...prev.tables, table] }))
    setSelectedId(table.id)
    pushHistory()
  }, [layout, pushHistory])

  const saveLayout = useCallback(() => {
    const json = JSON.stringify(layout, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `floor-plan-${layout.venueId}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [layout])

  const saveLayoutToServer = useCallback(async () => {
    if (!useAdminApi) return
    setSaveError(null)
    setSavingToServer(true)
    try {
      const res = await fetch("/api/admin/floor-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error || "Error al guardar")
        return
      }
    } catch {
      setSaveError("Error de conexión")
    } finally {
      setSavingToServer(false)
    }
  }, [useAdminApi, layout])

  const loadLayout = useCallback(() => {
    setLoadJsonOpen(true)
    setLoadJsonValue(JSON.stringify(layout, null, 2))
    setLoadJsonError("")
  }, [layout])

  const applyLoadJson = useCallback(() => {
    const next = parseLayoutJson(loadJsonValue)
    if (next) {
      setLayout(next)
      setBackgroundConfig(next.background)
      setSelectedId(null)
      setLoadJsonOpen(false)
      setLoadJsonError("")
    } else {
      setLoadJsonError("JSON inválido. Revisa el formato.")
    }
  }, [loadJsonValue])

  const exportPng = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const dataUrl = stage.toDataURL({ pixelRatio: 2 })
    const a = document.createElement("a")
    a.href = dataUrl
    a.download = `floor-plan-${layout.venueId}-${Date.now()}.png`
    a.click()
  }, [layout.venueId])

  const applyBackground = useCallback(() => {
    setLayout((prev) => ({
      ...prev,
      background: bgUrl.trim()
        ? { url: bgUrl.trim(), opacity: bgOpacity, scaleMode: bgScaleMode }
        : undefined,
    }))
    setBackgroundConfig(
      bgUrl.trim() ? { url: bgUrl.trim(), opacity: bgOpacity, scaleMode: bgScaleMode } : undefined
    )
    setBackgroundDialogOpen(false)
  }, [bgUrl, bgOpacity, bgScaleMode])

  const selectedTable = layout.tables.find((t) => t.id === selectedId) ?? null
  const canUndo = undoStackLength > 0
  const canRedo = redoStackLength > 0

  const openBackgroundDialog = useCallback(() => {
    setBgUrl(layout.background?.url ?? "")
    setBgOpacity(layout.background?.opacity ?? 0.8)
    setBgScaleMode(layout.background?.scaleMode ?? "contain")
    setBackgroundDialogOpen(true)
  }, [layout.background])

  // Mostrar el plano siempre; si useAdminApi, la API carga en segundo plano y actualiza el layout al responder
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-[600px] text-muted-foreground">
        Cargando plano…
      </div>
    )
  }

  return (
    <div
      className={`flex bg-background border border-border rounded-lg overflow-hidden ${
        embedded ? "h-full min-h-[500px]" : "h-[calc(100vh-4rem)]"
      }`}
    >
      {/* Left panel: Toolbar */}
      <aside className="w-56 shrink-0 border-r border-border flex flex-col overflow-y-auto bg-muted/30">
        {saveError && (
          <p className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-b border-border">
            {saveError}
          </p>
        )}
        <Toolbar
          showGrid={showGrid}
          onShowGridChange={setShowGrid}
          snapToGrid={snapToGrid}
          onSnapToGridChange={setSnapToGrid}
          onAddRoundTable={addRoundTable}
          onAddRectTable={addRectTable}
          onSaveLayout={saveLayout}
          onLoadLayout={loadLayout}
          onExportPng={exportPng}
          onBackgroundSettings={openBackgroundDialog}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onSaveToServer={useAdminApi ? saveLayoutToServer : undefined}
          savingToServer={savingToServer}
        />
      </aside>

      {/* Center: Stage - overflow-hidden para que no solape el panel de propiedades */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        <div className="absolute bottom-2 left-2 z-10 flex gap-4 text-xs text-muted-foreground bg-background/90 px-2 py-1 rounded border border-border">
          <span>Cursor: {pointer.x}, {pointer.y}</span>
          <span>Zoom: {Math.round(scale * 100)}%</span>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden" style={{ background: "#e2e8f0" }}>
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            onWheel={handleStageWheel}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onMouseLeave={handleStageMouseUp}
            style={{ cursor: isPanning || spaceDown ? "grabbing" : "default" }}
          >
            <Layer>
              <Group ref={zoomGroupRef} x={pan.x} y={pan.y} scaleX={scale} scaleY={scale}>
                {/* Grid */}
                {showGrid && (
                  <Group listening={false}>
                    {Array.from({ length: Math.ceil(layout.width / GRID_SIZE) + 1 }, (_, i) => (
                      <Rect
                        key={`v-${i}`}
                        x={i * GRID_SIZE}
                        y={0}
                        width={1}
                        height={layout.height}
                        fill="#cbd5e1"
                        listening={false}
                      />
                    ))}
                    {Array.from({ length: Math.ceil(layout.height / GRID_SIZE) + 1 }, (_, i) => (
                      <Rect
                        key={`h-${i}`}
                        x={0}
                        y={i * GRID_SIZE}
                        width={layout.width}
                        height={1}
                        fill="#cbd5e1"
                        listening={false}
                      />
                    ))}
                  </Group>
                )}

                {/* Background image */}
                {layout.background?.url && (
                  <BackgroundImage
                    url={layout.background.url}
                    opacity={layout.background.opacity}
                    scaleMode={layout.background.scaleMode}
                    layoutWidth={layout.width}
                    layoutHeight={layout.height}
                  />
                )}

                {/* Tables */}
                {layout.tables.map((table) => (
                  <TableShapeNode
                    key={table.id}
                    table={table}
                    isSelected={table.id === selectedId}
                    snapToGrid={snapToGrid}
                    gridSize={GRID_SIZE}
                    onSelect={() => setSelectedId(table.id)}
                    onUpdate={(updates) => updateTable(table.id, updates)}
                    onDragEnd={() => pushHistory()}
                    onTransformEnd={() => pushHistory()}
                    onRegisterRef={(id, node) => tableNodeRefs.current.set(id, node)}
                    onUnregisterRef={(id) => tableNodeRefs.current.delete(id)}
                  />
                ))}

                {/* Transformer for selected table */}
                {selectedId && selectedTable && !selectedTable.locked && (
                  <TransformerRef
                    selectedId={selectedId}
                    tableNodeRefs={tableNodeRefs}
                    selectedTable={selectedTable}
                  />
                )}
              </Group>
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Right panel: Properties - z-10 para que los clics no lleguen al stage */}
      <aside className="w-64 shrink-0 border-l border-border flex flex-col overflow-y-auto bg-muted/30 relative z-10">
        <PropertiesPanel
          table={selectedTable}
          onUpdate={(updates) => selectedId && updateTable(selectedId, updates)}
          onClose={() => setSelectedId(null)}
        />
      </aside>

      {/* Load JSON dialog */}
      <Dialog open={loadJsonOpen} onOpenChange={setLoadJsonOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cargar layout desde JSON</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Pega el JSON del plano (VenueLayout)</Label>
            <Textarea
              value={loadJsonValue}
              onChange={(e) => setLoadJsonValue(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            {loadJsonError && (
              <p className="text-sm text-destructive">{loadJsonError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadJsonOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={applyLoadJson}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Background settings dialog */}
      <Dialog open={backgroundDialogOpen} onOpenChange={setBackgroundDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Imagen de fondo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL de la imagen</Label>
              <Input
                value={bgUrl}
                onChange={(e) => setBgUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label>Opacidad</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[bgOpacity * 100]}
                  onValueChange={([v]) => setBgOpacity((v ?? 50) / 100)}
                  min={0}
                  max={100}
                />
                <span className="text-sm text-muted-foreground w-10">{Math.round(bgOpacity * 100)}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ajuste</Label>
              <Select value={bgScaleMode} onValueChange={(v) => setBgScaleMode(v as ScaleMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contain">Contener</SelectItem>
                  <SelectItem value="cover">Cubrir</SelectItem>
                  <SelectItem value="stretch">Estirar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBackgroundDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={applyBackground}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Background image layer: load image and fit to layout by scaleMode */
function BackgroundImage({
  url,
  opacity,
  scaleMode,
  layoutWidth,
  layoutHeight,
}: {
  url: string
  opacity: number
  scaleMode: ScaleMode
  layoutWidth: number
  layoutHeight: number
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = url
    return () => {
      img.src = ""
    }
  }, [url])

  if (!image) return null

  let x = 0
  let y = 0
  let w = layoutWidth
  let h = layoutHeight
  const imgW = image.naturalWidth || 1
  const imgH = image.naturalHeight || 1
  const layoutRatio = layoutWidth / layoutHeight
  const imgRatio = imgW / imgH

  if (scaleMode === "contain") {
    if (imgRatio > layoutRatio) {
      w = layoutWidth
      h = layoutWidth / imgRatio
      y = (layoutHeight - h) / 2
    } else {
      h = layoutHeight
      w = layoutHeight * imgRatio
      x = (layoutWidth - w) / 2
    }
  } else if (scaleMode === "cover") {
    if (imgRatio > layoutRatio) {
      h = layoutHeight
      w = layoutHeight * imgRatio
      x = (layoutWidth - w) / 2
    } else {
      w = layoutWidth
      h = layoutWidth / imgRatio
      y = (layoutHeight - h) / 2
    }
  }

  return (
    <KonvaImage
      image={image}
      x={x}
      y={y}
      width={w}
      height={h}
      opacity={opacity}
      listening={false}
    />
  )
}

/** Attaches Transformer to the selected table node */
function TransformerRef({
  selectedId,
  tableNodeRefs,
  selectedTable,
}: {
  selectedId: string
  tableNodeRefs: React.MutableRefObject<Map<string, Konva.Group>>
  selectedTable: TableNode
}) {
  const trRef = useRef<Konva.Transformer>(null)
  useEffect(() => {
    const node = tableNodeRefs.current.get(selectedId)
    if (trRef.current && node) {
      trRef.current.nodes([node])
      trRef.current.getLayer()?.batchDraw()
    }
    return () => {
      if (trRef.current) trRef.current.nodes([])
    }
  }, [selectedId, tableNodeRefs])
  return (
    <Transformer
      ref={trRef}
      rotateEnabled={true}
      boundBoxFunc={(oldBox, newBox) => {
        const min = 20
        if (Math.abs(newBox.width) < min || Math.abs(newBox.height) < min) return oldBox
        return newBox
      }}
    />
  )
}

/** Single table node: Group with shape + text, draggable */
function TableShapeNode({
  table,
  isSelected,
  snapToGrid,
  gridSize,
  onSelect,
  onUpdate,
  onDragEnd,
  onTransformEnd,
  onRegisterRef,
  onUnregisterRef,
}: {
  table: TableNode
  isSelected: boolean
  snapToGrid: boolean
  gridSize: number
  onSelect: () => void
  onUpdate: (u: Partial<TableNode>) => void
  onDragEnd: () => void
  onTransformEnd?: () => void
  onRegisterRef?: (id: string, node: Konva.Group) => void
  onUnregisterRef?: (id: string) => void
}) {
  const shapeRef = useRef<Konva.Group>(null)

  useEffect(() => {
    const node = shapeRef.current
    if (node) onRegisterRef?.(table.id, node)
    return () => onUnregisterRef?.(table.id)
  }, [table.id, onRegisterRef, onUnregisterRef])

  const style = table.style ?? { fill: "#f0f4f8", stroke: "#64748b", strokeWidth: 2, textColor: "#1e293b" }
  const isRound = table.shape === "round"
  const radius = table.radius ?? 40
  const width = table.width ?? 120
  const height = table.height ?? 60

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    let x = node.x()
    let y = node.y()
    if (snapToGrid) {
      const snapped = snapPoint(x, y, gridSize)
      x = snapped.x
      y = snapped.y
      node.position({ x, y })
    }
    onUpdate({ x, y })
    onDragEnd()
  }

  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (table.locked) e.target.stopDrag()
  }

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    if (isRound) {
      const newRadius = radius * Math.max(scaleX, scaleY)
      onUpdate({ radius: newRadius })
    } else {
      onUpdate({
        width: Math.max(20, width * scaleX),
        height: Math.max(20, height * scaleY),
      })
    }
    onUpdate({ rotation: node.rotation() })
    onTransformEnd?.()
  }

  return (
    <Group
      x={table.x}
      y={table.y}
      rotation={table.rotation}
      draggable={!table.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onTransformEnd={handleTransformEnd}
      ref={shapeRef}
      dragBoundFunc={
        table.locked
          ? undefined
          : (pos: { x: number; y: number }) => {
              if (snapToGrid) return snapPoint(pos.x, pos.y, gridSize)
              return pos
            }
      }
    >
      {isRound ? (
        <Circle
          radius={radius}
          x={0}
          y={0}
          fill={style.fill}
          stroke={isSelected ? "#3b82f6" : style.stroke}
          strokeWidth={isSelected ? 3 : style.strokeWidth}
          listening={true}
        />
      ) : (
        <Rect
          width={width}
          height={height}
          x={0}
          y={0}
          offsetX={width / 2}
          offsetY={height / 2}
          fill={style.fill}
          stroke={isSelected ? "#3b82f6" : style.stroke}
          strokeWidth={isSelected ? 3 : style.strokeWidth}
          listening={true}
        />
      )}
      {isRound ? (
        <Text
          text={`${table.name}\n${table.seats}`}
          fontSize={14}
          fontFamily="sans-serif"
          fill={style.textColor}
          align="center"
          verticalAlign="middle"
          width={radius * 2}
          height={radius * 2}
          x={-radius}
          y={-radius}
          listening={false}
          wrap="none"
          ellipsis
        />
      ) : (
        <Text
          text={`${table.name}\n${table.seats}`}
          fontSize={14}
          fontFamily="sans-serif"
          fill={style.textColor}
          align="center"
          verticalAlign="middle"
          width={width}
          height={height}
          x={0}
          y={0}
          offsetX={width / 2}
          offsetY={height / 2}
          listening={false}
          wrap="none"
          ellipsis
        />
      )}
    </Group>
  )
}
