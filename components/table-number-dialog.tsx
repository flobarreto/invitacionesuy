import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface TableNumberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rsvpName?: string
  initialTableNumber: string
  onSave: (value: string) => void
  tableNumbers: string[]
}

export default function TableNumberDialog({
  open,
  onOpenChange,
  rsvpName,
  initialTableNumber,
  onSave,
  tableNumbers,
}: TableNumberDialogProps) {
  const [value, setValue] = useState(initialTableNumber)

  useEffect(() => {
    if (open) {
      setValue(initialTableNumber)
    }
  }, [open, initialTableNumber])

  const tempTableNumber = value
  const trimmedValue = tempTableNumber.trim()
  const search = trimmedValue.toLowerCase()
  const filteredTableNumbers =
    search === ""
      ? tableNumbers
      : tableNumbers.filter((table) => table.toLowerCase().includes(search))

  const isNewTable =
    trimmedValue !== "" &&
    !tableNumbers.some(
      (table) => table.toLowerCase() === trimmedValue.toLowerCase()
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Mesa</DialogTitle>
          <DialogDescription>
            ¿En qué mesa se sienta <strong>{rsvpName}</strong>?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="table-number">Número de Mesa</Label>
            <div className="space-y-2">
              <Input
                id="table-number"
                type="text"
                value={tempTableNumber}
                onChange={(e) => {
                  setValue(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSave(tempTableNumber)
                  }
                }}
                placeholder="Ej: 11 o VIP"
                className="text-center text-lg"
                autoFocus
              />
              {filteredTableNumbers.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto bg-background text-sm">
                  {filteredTableNumbers.map((table) => (
                    <button
                      key={table}
                      type="button"
                      onClick={() => setValue(table)}
                      className={`w-full text-left px-3 py-1.5 hover:bg-accent ${
                        table === tempTableNumber ? "bg-accent" : ""
                      }`}
                    >
                      {table}
                    </button>
                  ))}
                </div>
              )}
              {isNewTable && (
                <p className="text-xs text-muted-foreground">
                  Se va a crear la mesa "{trimmedValue}".
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSave(tempTableNumber)
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

