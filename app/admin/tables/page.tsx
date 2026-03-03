"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCw, Users, X, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import TableNumberDialog from "@/components/table-number-dialog"

interface Tag {
  id: string
  name: string
  color: string
}

interface RSVP {
  id?: string
  name: string
  attendance: string
  dietary_preferences?: string[]
  favorite_song?: string
  created_at?: string
  tags?: string[]
  table_number?: string | null
}

export default function TablesPage() {
  const router = useRouter()
  const [rsvps, setRsvps] = useState<RSVP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [editingTagsForRsvp, setEditingTagsForRsvp] = useState<string | null>(null)
  const [editingTagsForRsvpMobile, setEditingTagsForRsvpMobile] = useState<string | null>(null)
  const [isTableNumberModalOpen, setIsTableNumberModalOpen] = useState(false)
  const [rsvpForTableNumber, setRsvpForTableNumber] = useState<RSVP | null>(null)

  const fetchRSVPs = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/rsvps")
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/admin/login")
          return
        }
        setError(data.error || "Error al cargar los RSVPs")
        setLoading(false)
        return
      }

      setRsvps(data.rsvps || [])
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  const fetchTags = async () => {
    setTagsLoading(true)
    try {
      const response = await fetch("/api/admin/tags")
      const data = await response.json()

      if (response.ok) {
        setAvailableTags(data.tags || [])
      }
    } catch (err) {
      console.error("Error fetching tags:", err)
    } finally {
      setTagsLoading(false)
    }
  }

  useEffect(() => {
    fetchRSVPs()
    fetchTags()
  }, [])

  const getTagById = (tagId: string) => {
    const tag = availableTags.find((tag) => {
      return String(tag.id) === String(tagId)
    })
    return tag
  }

  const handleTagToggle = async (rsvpId: string, tagId: string, currentTagIds: string[] = []) => {
    // Normalizar a strings para comparación
    const normalizedTagId = String(tagId)
    const isSelected = currentTagIds.some((id) => String(id) === normalizedTagId)
    const newTagIds = isSelected
      ? currentTagIds.filter((id) => String(id) !== normalizedTagId)
      : [...currentTagIds, normalizedTagId]
    
    try {
      const response = await fetch("/api/admin/update-rsvp-tags", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rsvpId,
          tagIds: newTagIds,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar las etiquetas")
      }

      // Actualizar el RSVP localmente
      setRsvps((prev) =>
        prev.map((rsvp) =>
          rsvp.id === rsvpId ? { ...rsvp, tags: newTagIds } : rsvp
        )
      )
    } catch (err) {
      console.error("Error updating tags:", err)
      alert(err instanceof Error ? err.message : "Error al actualizar las etiquetas")
    }
  }

  const handleTableNumberChange = async (rsvpId: string, tableNumber: string | null) => {
    if (!rsvpId) {
      console.error("No se proporcionó un ID de RSVP")
      return
    }

    try {
      const response = await fetch("/api/admin/update-rsvp-table-number", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rsvpId,
          tableNumber: tableNumber === null || tableNumber === undefined ? null : tableNumber,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar el número de mesa")
      }

      // Actualizar el RSVP localmente
      setRsvps((prev) =>
        prev.map((rsvp) =>
          rsvp.id === rsvpId ? { ...rsvp, table_number: data.rsvp?.table_number ?? null } : rsvp
        )
      )
    } catch (err) {
      console.error("Error updating table number:", err)
      alert(err instanceof Error ? err.message : "Error al actualizar el número de mesa")
      // Recargar los datos en caso de error
      await fetchRSVPs()
    }
  }

  const handleOpenTableNumberDialog = (rsvp: RSVP, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setRsvpForTableNumber(rsvp)
    setIsTableNumberModalOpen(true)
  }

  const handleSaveTableNumber = async (value: string) => {
    if (!rsvpForTableNumber?.id) return

    const trimmed = value.trim()
    const tableNumber = trimmed === "" ? null : trimmed.toUpperCase()

    await handleTableNumberChange(rsvpForTableNumber.id, tableNumber)
    setIsTableNumberModalOpen(false)
    setRsvpForTableNumber(null)
  }

  // Agrupar RSVPs por mesa (clave de agrupación = string de mesa)
  const rsvpsByTable = useMemo(() => {
    const grouped: Record<string, RSVP[]> = {}
    rsvps.forEach((rsvp) => {
      const rawTable = rsvp.table_number
      const key = typeof rawTable === "string" ? rawTable.trim() : null
      if (!key) {
        return
      }
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(rsvp)
    })
    return grouped
  }, [rsvps])

  // RSVPs sin mesa asignada (solo confirmados)
  const rsvpsWithoutTable = useMemo(() => {
    return rsvps.filter((rsvp) => {
      const hasNoTable = rsvp.table_number === null || rsvp.table_number === undefined
      const isConfirmed = rsvp.attendance?.toLowerCase().includes("sí") || rsvp.attendance?.toLowerCase().includes("si")
      return hasNoTable && isConfirmed
    })
  }, [rsvps])

  // Ordenar las mesas: primero numéricas (1,2,3...), luego alfabéticas (VIP, A, B...)
  const sortedTableNumbers = useMemo(() => {
    const keys = Object.keys(rsvpsByTable)
    const numericKeys: string[] = []
    const nonNumericKeys: string[] = []

    keys.forEach((key) => {
      const num = Number(key)
      if (!Number.isNaN(num)) {
        numericKeys.push(key)
      } else {
        nonNumericKeys.push(key)
      }
    })

    numericKeys.sort((a, b) => Number(a) - Number(b))
    nonNumericKeys.sort((a, b) => a.localeCompare(b, "es"))

    return [...numericKeys, ...nonNumericKeys]
  }, [rsvpsByTable])

  const handleCloseTableNumberDialog = () => {
    setIsTableNumberModalOpen(false)
    setRsvpForTableNumber(null)
  }

  const handleTableDialogOpenChange = (open: boolean) => {
    if (!open) {
      handleCloseTableNumberDialog()
    } else {
      setIsTableNumberModalOpen(true)
    }
  }

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 pt-16 md:pt-8 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Mesas</h1>
            <p className="text-muted-foreground mt-1">
              Organización de invitados por mesa
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchRSVPs}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button
              variant="outline"
              onClick={fetchRSVPs}
              className="mt-4"
            >
              Reintentar
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="mesas" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="mesas">
                <Users className="h-4 w-4 mr-2" />
                Mesas ({sortedTableNumbers.length})
              </TabsTrigger>
              <TabsTrigger value="sin-mesa">
                <Users className="h-4 w-4 mr-2" />
                Sin Mesa ({rsvpsWithoutTable.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mesas" className="mt-0">
              {sortedTableNumbers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedTableNumbers.map((tableNumber) => {
                    const tableRsvps = rsvpsByTable[tableNumber]
                    return (
                      <Card key={tableNumber}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            MESA: {tableNumber}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {tableRsvps.map((rsvp) => (
                              <div
                                key={rsvp.id}
                                className="flex items-start justify-between p-2 rounded border"
                              >
                                <div className="flex-1">
                                  <p className="font-medium">{rsvp.name}</p>
                                  {/* Desktop: Popover para editar etiquetas */}
                                  <div className="hidden md:block mt-1">
                                    <Popover
                                      open={editingTagsForRsvp === rsvp.id}
                                      onOpenChange={(open) =>
                                        setEditingTagsForRsvp(open ? rsvp.id || null : null)
                                      }
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant={rsvp.tags && rsvp.tags.length > 0 ? "ghost" : "outline"}
                                          size="sm"
                                          className="h-auto min-h-[32px] justify-start p-1"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingTagsForRsvp(rsvp.id || null)
                                          }}
                                        >
                                          {rsvp.tags && rsvp.tags.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {rsvp.tags.map((tagId) => {
                                                const tag = getTagById(tagId)
                                                return tag ? (
                                                  <Badge
                                                    key={tagId}
                                                    style={{ backgroundColor: tag.color }}
                                                    className="text-white border-0 text-xs"
                                                  >
                                                    {tag.name}
                                                  </Badge>
                                                ) : null
                                              })}
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                              <Tag className="h-3 w-3" />
                                              Agregar etiquetas
                                            </span>
                                          )}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
                                        <div className="space-y-2">
                                          <Label className="text-sm font-medium">Etiquetas</Label>
                                          {tagsLoading ? (
                                            <div className="text-sm text-muted-foreground">Cargando...</div>
                                          ) : availableTags.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">
                                              No hay etiquetas disponibles
                                            </div>
                                          ) : (
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                              {availableTags.map((tag) => {
                                                const isSelected = rsvp.tags?.some(
                                                  (tagId) => String(tagId) === String(tag.id)
                                                ) || false
                                                return (
                                                  <div
                                                    key={tag.id}
                                                    className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded"
                                                    onClick={() =>
                                                      handleTagToggle(
                                                        rsvp.id || "",
                                                        tag.id,
                                                        rsvp.tags || []
                                                      )
                                                    }
                                                  >
                                                    <Checkbox
                                                      checked={isSelected}
                                                      onCheckedChange={() =>
                                                        handleTagToggle(
                                                          rsvp.id || "",
                                                          tag.id,
                                                          rsvp.tags || []
                                                        )
                                                      }
                                                    />
                                                    <Badge
                                                      style={{ backgroundColor: tag.color }}
                                                      className="text-white border-0 flex-1"
                                                    >
                                                      {tag.name}
                                                    </Badge>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  {/* Mobile: Click para abrir dialog */}
                                  <div
                                    className="md:hidden mt-1 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingTagsForRsvpMobile(rsvp.id || null)
                                    }}
                                  >
                                    {rsvp.tags && rsvp.tags.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {rsvp.tags.map((tagId) => {
                                          const tag = getTagById(tagId)
                                          return tag ? (
                                            <Badge
                                              key={tagId}
                                              style={{ backgroundColor: tag.color }}
                                              className="text-white border-0 text-xs"
                                            >
                                              {tag.name}
                                            </Badge>
                                          ) : null
                                        })}
                                      </div>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setEditingTagsForRsvpMobile(rsvp.id || null)
                                        }}
                                      >
                                        <Tag className="h-3 w-3 mr-1" />
                                        Agregar etiquetas
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleTableNumberChange(rsvp.id || "", null)}
                                  title="Quitar de la mesa"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground mt-3">
                            {tableRsvps.length} {tableRsvps.length === 1 ? "persona" : "personas"}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                      No hay mesas asignadas
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="sin-mesa" className="mt-0">
              {rsvpsWithoutTable.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Personas sin Mesa Asignada</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Etiquetas</TableHead>
                            <TableHead>Mesa</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rsvpsWithoutTable.map((rsvp) => (
                            <TableRow key={rsvp.id}>
                              <TableCell className="font-medium">{rsvp.name}</TableCell>
                              <TableCell>
                                {/* Desktop: Popover para editar etiquetas */}
                                <div className="hidden md:block">
                                  <Popover
                                    open={editingTagsForRsvp === rsvp.id}
                                    onOpenChange={(open) =>
                                      setEditingTagsForRsvp(open ? rsvp.id || null : null)
                                    }
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant={rsvp.tags && rsvp.tags.length > 0 ? "ghost" : "outline"}
                                        size="sm"
                                        className="h-auto min-h-[32px] justify-start"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setEditingTagsForRsvp(rsvp.id || null)
                                        }}
                                      >
                                        {rsvp.tags && rsvp.tags.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {rsvp.tags.map((tagId) => {
                                              const tag = getTagById(tagId)
                                              return tag ? (
                                                <Badge
                                                  key={tagId}
                                                  style={{ backgroundColor: tag.color }}
                                                  className="text-white border-0 text-xs"
                                                >
                                                  {tag.name}
                                                </Badge>
                                              ) : null
                                            })}
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground flex items-center gap-1">
                                            <Tag className="h-3 w-3" />
                                            Agregar etiquetas
                                          </span>
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium">Etiquetas</Label>
                                        {tagsLoading ? (
                                          <div className="text-sm text-muted-foreground">Cargando...</div>
                                        ) : availableTags.length === 0 ? (
                                          <div className="text-sm text-muted-foreground">
                                            No hay etiquetas disponibles
                                          </div>
                                        ) : (
                                          <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {availableTags.map((tag) => {
                                              const isSelected = rsvp.tags?.some(
                                                (tagId) => String(tagId) === String(tag.id)
                                              ) || false
                                              return (
                                                <div
                                                  key={tag.id}
                                                  className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded"
                                                  onClick={() =>
                                                    handleTagToggle(
                                                      rsvp.id || "",
                                                      tag.id,
                                                      rsvp.tags || []
                                                    )
                                                  }
                                                >
                                                  <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() =>
                                                      handleTagToggle(
                                                        rsvp.id || "",
                                                        tag.id,
                                                        rsvp.tags || []
                                                      )
                                                    }
                                                  />
                                                  <Badge
                                                    style={{ backgroundColor: tag.color }}
                                                    className="text-white border-0 flex-1"
                                                  >
                                                    {tag.name}
                                                  </Badge>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                {/* Mobile: Click para abrir dialog */}
                                <div
                                  className="md:hidden cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingTagsForRsvpMobile(rsvp.id || null)
                                  }}
                                >
                                  {rsvp.tags && rsvp.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {rsvp.tags.map((tagId) => {
                                        const tag = getTagById(tagId)
                                        return tag ? (
                                          <Badge
                                            key={tagId}
                                            style={{ backgroundColor: tag.color }}
                                            className="text-white border-0 text-xs"
                                          >
                                            {tag.name}
                                          </Badge>
                                        ) : null
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">Sin etiquetas</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenTableNumberDialog(rsvp, e)}
                                  className="w-20 h-8 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring text-center text-sm bg-transparent hover:bg-accent rounded cursor-pointer flex items-center justify-center"
                                >
                                  {rsvp.table_number ?? "—"}
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                      No hay personas sin mesa asignada
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Modal para editar etiquetas en móvil */}
        <Dialog open={editingTagsForRsvpMobile !== null} onOpenChange={(open) => {
          if (!open) {
            setEditingTagsForRsvpMobile(null)
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Etiquetas</DialogTitle>
              <DialogDescription>
                {(() => {
                  const rsvp = rsvps.find((r) => r.id === editingTagsForRsvpMobile)
                  return rsvp ? `Etiquetas para ${rsvp.name}` : "Selecciona las etiquetas"
                })()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {tagsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Cargando etiquetas...</span>
                </div>
              ) : availableTags.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    No hay etiquetas disponibles
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {availableTags.map((tag) => {
                    const rsvp = rsvps.find((r) => r.id === editingTagsForRsvpMobile)
                    const isSelected = rsvp?.tags?.some(
                      (tagId) => String(tagId) === String(tag.id)
                    ) || false
                    return (
                      <div
                        key={tag.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded"
                        onClick={() => {
                          if (rsvp?.id) {
                            handleTagToggle(rsvp.id, tag.id, rsvp.tags || [])
                          }
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {
                            if (rsvp?.id) {
                              handleTagToggle(rsvp.id, tag.id, rsvp.tags || [])
                            }
                          }}
                        />
                        <Badge
                          style={{ backgroundColor: tag.color }}
                          className="text-white border-0 flex-1"
                        >
                          {tag.name}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingTagsForRsvpMobile(null)}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TableNumberDialog
          open={isTableNumberModalOpen}
          onOpenChange={handleTableDialogOpenChange}
          rsvpName={rsvpForTableNumber?.name}
          initialTableNumber={rsvpForTableNumber?.table_number?.toString() || ""}
          onSave={handleSaveTableNumber}
          tableNumbers={sortedTableNumbers}
        />
      </div>
    </div>
  )
}
