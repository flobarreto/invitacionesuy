"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TableNode, TableShape } from "./types"

export interface PropertiesPanelProps {
  table: TableNode | null
  onUpdate: (updates: Partial<TableNode>) => void
  onClose: () => void
}

export function PropertiesPanel({ table, onUpdate, onClose }: PropertiesPanelProps) {
  if (!table) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Selecciona una mesa para editar sus propiedades.
      </div>
    )
  }

  const style = table.style ?? { fill: "#f0f4f8", stroke: "#64748b", strokeWidth: 2, textColor: "#1e293b" }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Propiedades</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="table-name">Nombre</Label>
        <Input
          id="table-name"
          value={table.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Mesa 1"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="table-seats">Comensales</Label>
        <Input
          id="table-seats"
          type="number"
          min={1}
          max={99}
          value={table.seats}
          onChange={(e) => onUpdate({ seats: Math.max(1, parseInt(e.target.value, 10) || 1) })}
        />
      </div>

      <div className="space-y-2">
        <Label>Forma</Label>
        <Select
          value={table.shape}
          onValueChange={(v) => onUpdate({ shape: v as TableShape })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round">Redonda</SelectItem>
            <SelectItem value="rect">Rectangular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {table.shape === "rect" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="table-width">Ancho</Label>
            <Input
              id="table-width"
              type="number"
              min={20}
              value={table.width ?? 120}
              onChange={(e) => onUpdate({ width: Math.max(20, parseInt(e.target.value, 10) || 20) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="table-height">Alto</Label>
            <Input
              id="table-height"
              type="number"
              min={20}
              value={table.height ?? 60}
              onChange={(e) => onUpdate({ height: Math.max(20, parseInt(e.target.value, 10) || 20) })}
            />
          </div>
        </>
      )}

      {table.shape === "round" && (
        <div className="space-y-2">
          <Label htmlFor="table-radius">Radio</Label>
          <Input
            id="table-radius"
            type="number"
            min={10}
            value={table.radius ?? 40}
            onChange={(e) => onUpdate({ radius: Math.max(10, parseInt(e.target.value, 10) || 10) })}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="table-rotation">Rotación (°)</Label>
        <Input
          id="table-rotation"
          type="number"
          value={Math.round(table.rotation)}
          onChange={(e) => onUpdate({ rotation: parseInt(e.target.value, 10) || 0 })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="table-locked"
          checked={!!table.locked}
          onCheckedChange={(checked) => onUpdate({ locked: checked })}
        />
        <Label htmlFor="table-locked" className="text-sm cursor-pointer">
          Bloqueada
        </Label>
      </div>

      <div className="border-t pt-4 space-y-3">
        <span className="text-sm font-medium">Estilo</span>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Relleno</Label>
            <Input
              type="color"
              value={style.fill}
              onChange={(e) =>
                onUpdate({
                  style: { ...style, fill: e.target.value },
                })
              }
              className="h-8 w-full p-1 cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Borde</Label>
            <Input
              type="color"
              value={style.stroke}
              onChange={(e) =>
                onUpdate({
                  style: { ...style, stroke: e.target.value },
                })
              }
              className="h-8 w-full p-1 cursor-pointer"
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Grosor borde</Label>
            <Input
              type="number"
              min={0}
              value={style.strokeWidth}
              onChange={(e) =>
                onUpdate({
                  style: { ...style, strokeWidth: Math.max(0, parseInt(e.target.value, 10) || 0) },
                })
              }
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Color texto</Label>
            <Input
              type="color"
              value={style.textColor}
              onChange={(e) =>
                onUpdate({
                  style: { ...style, textColor: e.target.value },
                })
              }
              className="h-8 w-full p-1 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
