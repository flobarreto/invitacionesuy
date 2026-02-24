"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Circle,
  Square,
  Grid3X3,
  Magnet,
  Download,
  Upload,
  Image,
  Undo2,
  Redo2,
  Save,
} from "lucide-react"
import type { ScaleMode } from "./types"

export interface ToolbarProps {
  showGrid: boolean
  onShowGridChange: (v: boolean) => void
  snapToGrid: boolean
  onSnapToGridChange: (v: boolean) => void
  onAddRoundTable: () => void
  onAddRectTable: () => void
  onSaveLayout: () => void
  onLoadLayout: () => void
  onExportPng: () => void
  onBackgroundSettings: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** Guardar en servidor (admin); si está definido se muestra el botón "Guardar" */
  onSaveToServer?: () => void | Promise<void>
  savingToServer?: boolean
}

export function Toolbar({
  showGrid,
  onShowGridChange,
  snapToGrid,
  onSnapToGridChange,
  onAddRoundTable,
  onAddRectTable,
  onSaveLayout,
  onLoadLayout,
  onExportPng,
  onBackgroundSettings,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveToServer,
  savingToServer = false,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-4 p-4 border-b border-border">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Mesas</span>
        <Button variant="outline" size="sm" onClick={onAddRoundTable} className="gap-1.5">
          <Circle className="h-4 w-4" />
          Redonda
        </Button>
        <Button variant="outline" size="sm" onClick={onAddRectTable} className="gap-1.5">
          <Square className="h-4 w-4" />
          Rectangular
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="show-grid"
            checked={showGrid}
            onCheckedChange={onShowGridChange}
          />
          <Label htmlFor="show-grid" className="text-sm cursor-pointer flex items-center gap-1.5">
            <Grid3X3 className="h-4 w-4" />
            Grid
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="snap-grid"
            checked={snapToGrid}
            onCheckedChange={onSnapToGridChange}
          />
          <Label htmlFor="snap-grid" className="text-sm cursor-pointer flex items-center gap-1.5">
            <Magnet className="h-4 w-4" />
            Snap
          </Label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onUndo} disabled={!canUndo} className="gap-1.5">
          <Undo2 className="h-4 w-4" />
          Deshacer
        </Button>
        <Button variant="outline" size="sm" onClick={onRedo} disabled={!canRedo} className="gap-1.5">
          <Redo2 className="h-4 w-4" />
          Rehacer
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBackgroundSettings} className="gap-1.5">
          <Image className="h-4 w-4" />
          Fondo
        </Button>
        {onSaveToServer && (
          <Button
            variant="default"
            size="sm"
            onClick={onSaveToServer}
            disabled={savingToServer}
            className="gap-1.5"
          >
            <Save className={`h-4 w-4 ${savingToServer ? "animate-pulse" : ""}`} />
            {savingToServer ? "Guardando…" : "Guardar"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onSaveLayout} className="gap-1.5">
          <Save className="h-4 w-4" />
          Descargar JSON
        </Button>
        <Button variant="outline" size="sm" onClick={onLoadLayout} className="gap-1.5">
          <Upload className="h-4 w-4" />
          Cargar JSON
        </Button>
        <Button variant="outline" size="sm" onClick={onExportPng} className="gap-1.5">
          <Download className="h-4 w-4" />
          Exportar PNG
        </Button>
      </div>
    </div>
  )
}
