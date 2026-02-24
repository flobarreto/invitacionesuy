"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCw, Plus, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Tag {
  id: string
  name: string
  color: string
}

// 20 colores predefinidos
const AVAILABLE_COLORS = [
  "#EF4444", // red-500
  "#F97316", // orange-500
  "#F59E0B", // amber-500
  "#EAB308", // yellow-500
  "#84CC16", // lime-500
  "#22C55E", // green-500
  "#10B981", // emerald-500
  "#14B8A6", // teal-500
  "#06B6D4", // cyan-500
  "#0EA5E9", // sky-500
  "#3B82F6", // blue-500
  "#6366F1", // indigo-500
  "#8B5CF6", // violet-500
  "#A855F7", // purple-500
  "#D946EF", // fuchsia-500
  "#EC4899", // pink-500
  "#F43F5E", // rose-500
  "#64748B", // slate-500
  "#78716C", // stone-500
  "#57534E", // neutral-600
]

export default function TagsPage() {
  const router = useRouter()
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    color: AVAILABLE_COLORS[0],
  })

  const fetchTags = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/tags")
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/admin/login")
          return
        }
        setError(data.error || "Error al cargar las etiquetas")
        setLoading(false)
        return
      }

      setTags(data.tags || [])
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTags()
  }, [])

  const handleAddTag = async () => {
    setSubmitError("")
    
    if (!formData.name.trim()) {
      setSubmitError("El nombre es obligatorio")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/admin/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          color: formData.color,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al agregar la etiqueta")
      }

      // Cerrar modal y resetear formulario
      setIsAddModalOpen(false)
      setFormData({
        name: "",
        color: AVAILABLE_COLORS[0],
      })
      setSubmitError("")
      
      // Recargar la lista de etiquetas
      await fetchTags()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al agregar la etiqueta")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditClick = (tag: Tag) => {
    console.log("Editing tag:", tag)
    setEditingTag(tag)
    setFormData({
      name: tag.name,
      color: tag.color,
    })
    setIsEditModalOpen(true)
    setSubmitError("")
  }

  const handleEditTag = async () => {
    if (!editingTag) return

    setSubmitError("")
    
    if (!formData.name.trim()) {
      setSubmitError("El nombre es obligatorio")
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        id: editingTag.id,
        name: formData.name.trim(),
        color: formData.color,
      }
      console.log("Sending update payload:", payload)
      
      const response = await fetch("/api/admin/tags", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar la etiqueta")
      }

      // Cerrar modal y resetear formulario
      setIsEditModalOpen(false)
      setEditingTag(null)
      setFormData({
        name: "",
        color: AVAILABLE_COLORS[0],
      })
      setSubmitError("")
      
      // Recargar la lista de etiquetas
      await fetchTags()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al actualizar la etiqueta")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 pt-16 md:pt-8 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Etiquetas</h1>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Etiqueta
            </Button>
            <Button
              variant="outline"
              onClick={fetchTags}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Tags Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Etiquetas</CardTitle>
            <CardDescription>
              Crea y asocia etiquetas a tus invitados
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  onClick={fetchTags}
                  className="mt-4"
                >
                  Reintentar
                </Button>
              </div>
            ) : tags.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No hay etiquetas disponibles
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tags.map((tag) => (
                      <TableRow key={tag.id}>
                        <TableCell className="font-medium">{tag.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="text-sm text-muted-foreground">{tag.color}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditClick(tag)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal para agregar etiqueta */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Agregar Etiqueta</DialogTitle>
              <DialogDescription>
                Completa los datos de la etiqueta para agregarla
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">

              <div className="space-y-2">
                <Label htmlFor="tag-name">Nombre *</Label>
                <Input
                  id="tag-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="border-0 border-b rounded-none shadow-none focus-visible:border-b focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Nombre de la etiqueta"
                />
              </div>

              <div className="space-y-2">
                <Label>Color *</Label>
                <div className="grid grid-cols-5 gap-3">
                  {AVAILABLE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-12 h-12 rounded-full border-2 transition-all hover:scale-110 ${
                        formData.color === color
                          ? "border-gray-900 dark:border-gray-100 ring-2 ring-offset-2 ring-gray-400"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Seleccionar color ${color}`}
                    />
                  ))}
                </div>
              </div>

              {submitError && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {submitError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false)
                  setFormData({
                    name: "",
                    color: AVAILABLE_COLORS[0],
                  })
                  setSubmitError("")
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddTag} disabled={isSubmitting}>
                {isSubmitting ? "Agregando..." : "Agregar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal para editar etiqueta */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Etiqueta</DialogTitle>
              <DialogDescription>
                Modifica los datos de la etiqueta
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-tag-name">Nombre *</Label>
                <Input
                  id="edit-tag-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="border-0 border-b rounded-none shadow-none focus-visible:border-b focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Nombre de la etiqueta"
                />
              </div>

              <div className="space-y-2">
                <Label>Color *</Label>
                <div className="grid grid-cols-5 gap-3">
                  {AVAILABLE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-12 h-12 rounded-full border-2 transition-all hover:scale-110 ${
                        formData.color === color
                          ? "border-gray-900 dark:border-gray-100 ring-2 ring-offset-2 ring-gray-400"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Seleccionar color ${color}`}
                    />
                  ))}
                </div>
              </div>

              {submitError && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {submitError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false)
                  setEditingTag(null)
                  setFormData({
                    name: "",
                    color: AVAILABLE_COLORS[0],
                  })
                  setSubmitError("")
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button onClick={handleEditTag} disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
