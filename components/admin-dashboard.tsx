"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCw, Users, Download, Search, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface RSVP {
  id?: string
  name: string
  attendance: string
  dietary_preferences?: string[]
  favorite_song?: string
  created_at?: string
}

interface AdminDashboardProps {
  username: string
}

export default function AdminDashboard({ username }: AdminDashboardProps) {
  const router = useRouter()
  const [rsvps, setRsvps] = useState<RSVP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tableName, setTableName] = useState<string>(username)
  const [eventName, setEventName] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showOnlyConfirmed, setShowOnlyConfirmed] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [rsvpToDelete, setRsvpToDelete] = useState<RSVP | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    attendance: "Sí",
    dietaryPreferences: ["no"] as string[],
    dietaryOther: "",
    favoriteSong: "",
  })

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
      if (data.tableName) {
        setTableName(data.tableName)
      }
      if (data.eventName) {
        setEventName(data.eventName)
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRSVPs()
  }, [])


  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleString("es-UY", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  const toggleRow = (rsvpId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(rsvpId)) {
        newSet.delete(rsvpId)
      } else {
        newSet.add(rsvpId)
      }
      return newSet
    })
  }

  // Función para verificar si un RSVP está confirmado
  const isConfirmed = (rsvp: RSVP) => {
    const attendance = rsvp.attendance?.toLowerCase() || ""
    return attendance.includes("sí") || attendance.includes("si")
  }

  // Filtrar RSVPs por búsqueda y confirmados
  const filteredRsvps = useMemo(() => {
    let filtered = rsvps

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((rsvp) =>
        rsvp.name.toLowerCase().includes(query)
      )
    }

    // Filtrar solo confirmados si está activo
    if (showOnlyConfirmed) {
      filtered = filtered.filter(isConfirmed)
    }

    return filtered
  }, [rsvps, searchQuery, showOnlyConfirmed])

  // Detectar si la tabla tiene la columna favorite_song
  const hasFavoriteSong = useMemo(() => {
    return rsvps.some((rsvp) => 
      rsvp.favorite_song !== undefined && 
      rsvp.favorite_song !== null && 
      rsvp.favorite_song.trim() !== ""
    )
  }, [rsvps])

  // Estadísticas totales (sin filtrar por confirmados)
  const totalConfirmedCount = rsvps.filter(isConfirmed).length
  const totalDeclinedCount = rsvps.length - totalConfirmedCount
  
  // Estadísticas filtradas (solo para mostrar en la tabla)
  const confirmedCount = filteredRsvps.filter(isConfirmed).length
  const declinedCount = filteredRsvps.length - confirmedCount

  const handleAddGuest = async () => {
    setSubmitError("")
    
    if (!formData.name.trim()) {
      setSubmitError("El nombre es obligatorio")
      return
    }

    setIsSubmitting(true)
    try {
      // Procesar preferencias dietéticas: solo valores válidos (celiaco, veggie) y el texto de "otro" sin duplicados
      const validPreferences = formData.dietaryPreferences
        .filter((p) => p !== "no" && p !== "otro" && !p.startsWith("otro:"))
        .filter((value, index, self) => self.indexOf(value) === index) // Eliminar duplicados
      
      // Agregar el texto de "otro" si existe
      const finalPreferences = formData.dietaryOther.trim()
        ? [...validPreferences, formData.dietaryOther.trim()].filter((value, index, self) => self.indexOf(value) === index)
        : validPreferences

      const response = await fetch("/api/admin/add-rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          attendance: formData.attendance,
          dietaryPreferences: finalPreferences,
          favoriteSong: formData.favoriteSong.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al agregar el invitado")
      }

      // Cerrar modal y resetear formulario
      setIsAddModalOpen(false)
      setFormData({
        name: "",
        attendance: "Sí",
        dietaryPreferences: [],
        dietaryOther: "",
        favoriteSong: "",
      })
      setSubmitError("")
      
      // Recargar la lista de RSVPs
      await fetchRSVPs()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al agregar el invitado")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDietaryPreferenceChange = (value: string, checked: boolean) => {
    setFormData((prev) => {
      if (value === "no") {
        return {
          ...prev,
          dietaryPreferences: checked ? ["no"] : [],
        }
      }

      if (checked) {
        const withoutNo = prev.dietaryPreferences.filter((p) => p !== "no")
        if (withoutNo.includes(value)) return prev
        return {
          ...prev,
          dietaryPreferences: [...withoutNo, value],
        }
      }

      return {
        ...prev,
        dietaryPreferences: prev.dietaryPreferences.filter((p) => p !== value),
      }
    })
  }

  const handleDeleteClick = (rsvp: RSVP, e: React.MouseEvent) => {
    e.stopPropagation()
    setRsvpToDelete(rsvp)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!rsvpToDelete || !rsvpToDelete.id) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch("/api/admin/delete-rsvp", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: rsvpToDelete.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar el invitado")
      }

      // Cerrar modal y recargar la lista
      setIsDeleteModalOpen(false)
      setRsvpToDelete(null)
      await fetchRSVPs()
    } catch (err) {
      console.error("Error deleting RSVP:", err)
      alert(err instanceof Error ? err.message : "Error al eliminar el invitado")
    } finally {
      setIsDeleting(false)
    }
  }

  // Función para descargar CSV
  const handleDownloadCSV = () => {
    const headers = hasFavoriteSong
      ? ["Nombre", "Asistencia", "Preferencias Dietéticas", "Canción Favorita", "Fecha de Respuesta"]
      : ["Nombre", "Asistencia", "Preferencias Dietéticas", "Fecha de Respuesta"]
    
    const csvRows = [
      headers.join(","),
      ...filteredRsvps.map((rsvp) => {
        const dietary = rsvp.dietary_preferences && rsvp.dietary_preferences.length > 0
          ? Array.isArray(rsvp.dietary_preferences)
            ? rsvp.dietary_preferences.join("; ")
            : rsvp.dietary_preferences
          : "no"
        
        const date = rsvp.created_at ? formatDate(rsvp.created_at) : "N/A"
        
        // Escapar comillas y comas en los valores
        const escapeCSV = (value: string) => {
          if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }
        
        const row = [
          escapeCSV(rsvp.name),
          escapeCSV(rsvp.attendance),
          escapeCSV(dietary),
        ]
        
        if (hasFavoriteSong) {
          const favoriteSong = rsvp.favorite_song || ""
          row.push(escapeCSV(favoriteSong))
        }
        
        row.push(escapeCSV(date))
        
        return row.join(",")
      }),
    ]

    const csvContent = csvRows.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    
    link.setAttribute("href", url)
    link.setAttribute("download", `confirmaciones-${tableName}-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 pt-16 md:pt-8 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">{eventName || "Admin Dashboard"}</h1>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Respuestas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rsvps.length}</div>
              <p className="text-xs text-muted-foreground">
                Personas que respondieron
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalConfirmedCount}</div>
              <p className="text-xs text-muted-foreground">Asistirán al evento</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">No Confirmados</CardTitle>
              <Users className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalDeclinedCount}</div>
              <p className="text-xs text-muted-foreground">No asistirán</p>
            </CardContent>
          </Card>
        </div>

        {/* RSVPs Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Lista de Confirmaciones</CardTitle>
                <CardDescription>
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="show-only-confirmed"
                    checked={showOnlyConfirmed}
                    onCheckedChange={(checked) => setShowOnlyConfirmed(checked === true)}
                  />
                  <Label
                    htmlFor="show-only-confirmed"
                    className="text-sm font-medium cursor-pointer whitespace-nowrap"
                  >
                    Ver solo confirmados
                  </Label>
                </div>
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Invitado
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadCSV}
                  disabled={filteredRsvps.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Lista
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            {rsvps.length > 0 && (
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {(searchQuery || showOnlyConfirmed) && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Mostrando {filteredRsvps.length} de {rsvps.length} resultados
                    {showOnlyConfirmed && " (solo confirmados)"}
                  </p>
                )}
              </div>
            )}
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
            ) : filteredRsvps.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery ? "No se encontraron resultados para tu búsqueda" : "No hay confirmaciones aún"}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile View - Expandible Cards */}
                <div className="block md:hidden space-y-3">
                  {filteredRsvps.map((rsvp, index) => {
                    const rsvpId = rsvp.id || `rsvp-${index}`
                    const isExpanded = expandedRows.has(rsvpId)
                    const isConfirmed = rsvp.attendance?.toLowerCase().includes("sí") || rsvp.attendance?.toLowerCase().includes("si")
                    
                    return (
                      <Card key={rsvpId} className="cursor-pointer" onClick={() => toggleRow(rsvpId)}>
                        <CardContent className="p-4 py-0">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-base">{rsvp.name}</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={(e) => handleDeleteClick(rsvp, e)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              {isExpanded && (
                                <div className="mt-3 space-y-2 pt-3 border-t">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Asistencia</p>
                                    <span
                                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        isConfirmed
                                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                          : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                      }`}
                                    >
                                      {rsvp.attendance}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Preferencias Dietéticas</p>
                                    <p className="text-sm">
                                      {rsvp.dietary_preferences && rsvp.dietary_preferences.length > 0
                                        ? Array.isArray(rsvp.dietary_preferences)
                                          ? rsvp.dietary_preferences.join(", ")
                                          : rsvp.dietary_preferences
                                        : "no"}
                                    </p>
                                  </div>
                                  {hasFavoriteSong && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Canción Favorita</p>
                                      <p className="text-sm">{rsvp.favorite_song || "—"}</p>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Fecha de Respuesta</p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatDate(rsvp.created_at)}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="ml-2">
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {/* Desktop View - Full Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Asistencia</TableHead>
                        <TableHead>Preferencias Dietéticas</TableHead>
                        {hasFavoriteSong && <TableHead>Canción Favorita</TableHead>}
                        <TableHead>Fecha de Respuesta</TableHead>
                        <TableHead className="w-[100px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRsvps.map((rsvp, index) => {
                        const isConfirmed = rsvp.attendance?.toLowerCase().includes("sí") || rsvp.attendance?.toLowerCase().includes("si")
                        
                        return (
                          <TableRow key={rsvp.id || index}>
                            <TableCell className="font-medium">{rsvp.name}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  isConfirmed
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                }`}
                              >
                                {rsvp.attendance}
                              </span>
                            </TableCell>
                            <TableCell>
                              {rsvp.dietary_preferences && rsvp.dietary_preferences.length > 0
                                ? Array.isArray(rsvp.dietary_preferences)
                                  ? rsvp.dietary_preferences.join(", ")
                                  : rsvp.dietary_preferences
                                : "no"}
                            </TableCell>
                            {hasFavoriteSong && (
                              <TableCell className="max-w-xs truncate">
                                {rsvp.favorite_song || "—"}
                              </TableCell>
                            )}
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(rsvp.created_at)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => handleDeleteClick(rsvp, e)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Modal para confirmar eliminación */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Eliminar Invitado</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar a <strong>{rsvpToDelete?.name}</strong>? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setRsvpToDelete(null)
                }}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal para agregar invitado */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Agregar Invitado</DialogTitle>
              <DialogDescription>
                Completa los datos del invitado para agregarlo a la lista
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="border-0 border-b rounded-none shadow-none focus-visible:border-b focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Nombre y apellido"
                />
              </div>

              <div className="space-y-2">
                <Label>Asistencia *</Label>
                <RadioGroup
                  value={formData.attendance}
                  onValueChange={(value) =>
                    setFormData({ ...formData, attendance: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Sí" id="attendance-si" />
                    <Label htmlFor="attendance-si" className="font-normal cursor-pointer">
                      Sí
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="No" id="attendance-no" />
                    <Label htmlFor="attendance-no" className="font-normal cursor-pointer">
                      No
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Preferencias Dietéticas</Label>
                <div className="space-y-2">
                  {[
                    { value: "no", label: "No" },
                    { value: "celiaco", label: "Celíaco/a" },
                    { value: "veggie", label: "Veggie" },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dietary-${option.value}`}
                        checked={formData.dietaryPreferences.includes(option.value)}
                        onCheckedChange={(checked) =>
                          handleDietaryPreferenceChange(
                            option.value,
                            checked === true
                          )
                        }
                      />
                      <Label
                        htmlFor={`dietary-${option.value}`}
                        className="font-normal cursor-pointer"
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}

                    <Input
                      id="dietary-other"
                      value={formData.dietaryOther}
                      onChange={(e) =>
                        setFormData({ ...formData, dietaryOther: e.target.value })
                      }
                      placeholder="Otra preferencia alimentaria"
                      className="border-0 border-b rounded-none shadow-none focus-visible:border-b focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                </div>
              </div>

              {hasFavoriteSong && (
                <div className="space-y-2">
                  <Label htmlFor="favoriteSong">Canción Favorita</Label>
                  <Textarea
                    id="favoriteSong"
                    value={formData.favoriteSong}
                    onChange={(e) =>
                      setFormData({ ...formData, favoriteSong: e.target.value })
                    }
                    placeholder="Opcional"
                    rows={2}
                  />
                </div>
              )}

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
                    attendance: "Sí",
                    dietaryPreferences: [],
                    dietaryOther: "",
                    favoriteSong: "",
                  })
                  setSubmitError("")
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddGuest} disabled={isSubmitting}>
                {isSubmitting ? "Agregando..." : "Agregar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
