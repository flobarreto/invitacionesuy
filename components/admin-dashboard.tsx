"use client"

import { useEffect, useState, useMemo, useRef } from "react"
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
import { RefreshCw, Users, Download, Search, ChevronDown, ChevronUp, Plus, Trash2, Tag, Filter, X } from "lucide-react"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import TableNumberDialog from "@/components/table-number-dialog"
import { tryParseJsonStringArray } from "@/lib/adminDrinks"
import { serializeCsv } from "@/lib/csv-export"

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
  drink?: string[]
  /** Some events store a single string; others (e.g. save_the_date) may use a string array in DB. */
  favorite_song?: string | string[]
  email?: string | null
  created_at?: string
  tags?: string[]
  table_number?: string | null
}

function formatFavoriteSongForDisplay(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value.trim()
  if (Array.isArray(value)) {
    return value
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .join(", ")
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim()
  }
  return ""
}

function hasNonEmptyFavoriteSong(value: unknown): boolean {
  return formatFavoriteSongForDisplay(value) !== ""
}

const SAVE_THE_DATE_EXCLUDED_KEYS = new Set([
  "id",
  "created_at",
  "is_save_the_date",
  "isSaveTheDate",
  "tags",
  "table_number",
])

function columnHasMeaningfulValueForStd(key: string, value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === "string") {
    const t = value.trim()
    if (t === "" || t === "—") return false
    if (key === "attendance" && t.toLowerCase() === "save_the_date") return false
    return true
  }
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") return Object.keys(value as object).length > 0
  return true
}

function saveTheDateColumnLabel(key: string): string {
  const labels: Record<string, string> = {
    drink: "Bebida(s)",
    favorite_song: "Canción favorita",
    name: "Nombre",
    attendance: "Asistencia",
    dietary_preferences: "Preferencias dietéticas",
    email: "Email",
    tags: "Etiquetas",
    table_number: "Mesa",
  }
  return labels[key] ?? key.replace(/_/g, " ")
}

/** Texto plano para búsqueda / CSV (sin resolver nombres de etiquetas). */
function formatRsvpFieldForDisplay(key: string, value: unknown): string {
  if (value === undefined || value === null) return ""
  if (key === "favorite_song") return formatFavoriteSongForDisplay(value)
  if (Array.isArray(value)) {
    return value
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .join(", ")
  }
  if (typeof value === "string") {
    if (key === "drink" || key === "dietary_preferences") {
      const fromJson = tryParseJsonStringArray(value)
      if (fromJson !== null) return fromJson.join(", ")
    }
    return value.trim()
  }
  if (typeof value === "object") return JSON.stringify(value)
  return String(value).trim()
}

function saveTheDateRowSearchText(rsvp: RSVP): string {
  const row = rsvp as unknown as Record<string, unknown>
  return Object.keys(row)
    .filter((k) => !SAVE_THE_DATE_EXCLUDED_KEYS.has(k))
    .map((k) => formatRsvpFieldForDisplay(k, row[k]).toLowerCase())
    .join(" ")
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
  const [showOnlyUnconfirmed, setShowOnlyUnconfirmed] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [rsvpToDelete, setRsvpToDelete] = useState<RSVP | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [editingTagsForRsvp, setEditingTagsForRsvp] = useState<string | null>(null)
  const [editingTagsForRsvpMobile, setEditingTagsForRsvpMobile] = useState<string | null>(null)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([])
  const [isTableNumberModalOpen, setIsTableNumberModalOpen] = useState(false)
  const [rsvpForTableNumber, setRsvpForTableNumber] = useState<RSVP | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    attendance: "Sí",
    dietaryPreferences: ["no"] as string[],
    dietaryOther: "",
    favoriteSong: "",
  })
  const addGuestAttempt = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null)

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
      if (data.tableName) setTableName(data.tableName)
      if (data.eventName) setEventName(data.eventName)
    } catch {
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

  const isSaveTheDateTable = tableName.toLowerCase().includes("save_the_date")

  useEffect(() => {
    void fetchRSVPs()
    if (!isSaveTheDateTable) {
      void fetchTags()
    }
  }, [])

  const handleRefresh = () => {
    void fetchRSVPs()
    if (!isSaveTheDateTable) {
      void fetchTags()
    }
  }

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

  const saveTheDateColumnKeys = useMemo(() => {
    if (!isSaveTheDateTable) return [] as string[]
    if (rsvps.length === 0) {
      return ["drink", "favorite_song"]
    }
    const keys = new Set<string>()
    for (const rsvp of rsvps) {
      const row = rsvp as unknown as Record<string, unknown>
      for (const k of Object.keys(row)) {
        if (SAVE_THE_DATE_EXCLUDED_KEYS.has(k)) continue
        if (columnHasMeaningfulValueForStd(k, row[k])) keys.add(k)
      }
    }
    const preferred = ["drink", "favorite_song"]
    const ordered = preferred.filter((k) => keys.has(k))
    const rest = [...keys].filter((k) => !preferred.includes(k)).sort()
    const result = [...ordered, ...rest]
    return result.length > 0 ? result : ["drink", "favorite_song"]
  }, [isSaveTheDateTable, rsvps])

  // Filtrar RSVPs por búsqueda, confirmados y etiquetas
  const filteredRsvps = useMemo(() => {
    let filtered = rsvps

    if (isSaveTheDateTable) {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter((rsvp) =>
          saveTheDateRowSearchText(rsvp).includes(query)
        )
      }
      return filtered
    }

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((rsvp) =>
        (rsvp.name ?? "").toLowerCase().includes(query)
      )
    }

    // Filtrar solo confirmados si está activo
    if (showOnlyConfirmed) {
      filtered = filtered.filter(isConfirmed)
    }

    // Filtrar solo no confirmados si está activo
    if (showOnlyUnconfirmed) {
      filtered = filtered.filter((rsvp) => !isConfirmed(rsvp))
    }

    // Filtrar por etiquetas seleccionadas
    if (selectedFilterTags.length > 0) {
      filtered = filtered.filter((rsvp) => {
        if (!rsvp.tags || rsvp.tags.length === 0) return false
        // Verificar si el RSVP tiene al menos una de las etiquetas seleccionadas
        return selectedFilterTags.some((filterTagId) =>
          rsvp.tags?.some((rsvpTagId) => String(rsvpTagId) === String(filterTagId))
        )
      })
    }

    return filtered
  }, [
    rsvps,
    searchQuery,
    showOnlyConfirmed,
    showOnlyUnconfirmed,
    selectedFilterTags,
    isSaveTheDateTable,
  ])

  // Detectar si la tabla tiene la columna favorite_song
  const hasFavoriteSong = useMemo(() => {
    return rsvps.some((rsvp) => hasNonEmptyFavoriteSong(rsvp.favorite_song))
  }, [rsvps])

  const hasEmail = useMemo(() => {
    return rsvps.some(
      (rsvp) =>
        rsvp.email !== undefined &&
        rsvp.email !== null &&
        String(rsvp.email).trim() !== ""
    )
  }, [rsvps])

  // Estadísticas totales (sin filtrar por confirmados)
  const totalConfirmedCount = rsvps.filter(isConfirmed).length
  const totalDeclinedCount = rsvps.length - totalConfirmedCount
  
  // Estadísticas filtradas (solo para mostrar en la tabla)

  const tableNumbers = useMemo(() => {
    const set = new Set<string>()
    rsvps.forEach((rsvp) => {
      const value = (rsvp.table_number ?? "").toString().trim()
      if (value) {
        set.add(value)
      }
    })
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
    )
  }, [rsvps])

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

      const payload = {
        name: formData.name.trim(),
        attendance: formData.attendance,
        dietaryPreferences: finalPreferences,
        favoriteSong: formData.favoriteSong.trim(),
      }
      const fingerprint = JSON.stringify(payload)
      if (addGuestAttempt.current?.fingerprint !== fingerprint) {
        addGuestAttempt.current = { fingerprint, idempotencyKey: crypto.randomUUID() }
      }
      const response = await fetch("/api/admin/add-rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": addGuestAttempt.current.idempotencyKey,
        },
        body: fingerprint,
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
      addGuestAttempt.current = null
      
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

  const getTagById = (tagId: string) => {
    const tag = availableTags.find((tag) => {
      // Comparar como string para evitar problemas de tipo
      return String(tag.id) === String(tagId)
    })
    return tag
  }

  const getSaveTheDateCellText = (key: string, rsvp: RSVP): string => {
    if (key === "tags") {
      const ids = rsvp.tags
      if (!ids?.length) return "—"
      const names = ids
        .map((id) => getTagById(String(id))?.name ?? String(id))
        .filter(Boolean)
      return names.length ? names.join(", ") : "—"
    }
    const v = (rsvp as unknown as Record<string, unknown>)[key]
    const text = formatRsvpFieldForDisplay(key, v)
    return text || "—"
  }

  const handleTableNumberChange = async (rsvpId: string, tableNumber: string | null) => {
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

  // Función para descargar CSV
  const handleDownloadCSV = () => {
    if (isSaveTheDateTable) {
      const headers = saveTheDateColumnKeys.map((k) => saveTheDateColumnLabel(k))
      const csvRows = [
        headers,
        ...filteredRsvps.map((rsvp) =>
          saveTheDateColumnKeys
            .map((key) => getSaveTheDateCellText(key, rsvp)),
        ),
      ]
      const csvContent = serializeCsv(csvRows)
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute(
        "download",
        `confirmaciones-${tableName}-${new Date().toISOString().split("T")[0]}.csv`,
      )
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }

    const headers = [
      "Nombre",
      "Asistencia",
      "Preferencias Dietéticas",
      ...(hasFavoriteSong ? ["Canción Favorita"] : []),
      ...(hasEmail ? ["Email"] : []),
      "Etiquetas",
      "Fecha de Respuesta",
    ]

    const csvRows = [
      headers,
      ...filteredRsvps.map((rsvp) => {
        const dietary =
          rsvp.dietary_preferences && rsvp.dietary_preferences.length > 0
            ? Array.isArray(rsvp.dietary_preferences)
              ? rsvp.dietary_preferences.join("; ")
              : rsvp.dietary_preferences
            : "no"

        const date = rsvp.created_at ? formatDate(rsvp.created_at) : "N/A"

        // Obtener nombres de etiquetas
        const tagNames =
          rsvp.tags && rsvp.tags.length > 0
            ? rsvp.tags
                .map((tagId) => {
                  const tag = getTagById(tagId)
                  return tag ? tag.name : null
                })
                .filter((name) => name !== null)
                .join("; ")
            : ""

        const row = [
          rsvp.name,
          rsvp.attendance,
          dietary,
        ]

        if (hasFavoriteSong) {
          row.push(formatFavoriteSongForDisplay(rsvp.favorite_song))
        }

        if (hasEmail) {
          row.push((rsvp.email ?? "").toString().trim())
        }

        row.push(tagNames)
        row.push(date)

        return row
      }),
    ]

    const csvContent = serializeCsv(csvRows)
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    
    link.setAttribute("href", url)
    link.setAttribute("download", `confirmaciones-${tableName}-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 pt-16 md:pt-8 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">{eventName || "Admin Dashboard"}</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div
          className={`grid grid-cols-1 gap-4 ${isSaveTheDateTable ? "" : "md:grid-cols-3"}`}
        >
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              !isSaveTheDateTable &&
              !showOnlyConfirmed &&
              !showOnlyUnconfirmed
                ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-900"
                : ""
            }`}
            onClick={() => {
              if (isSaveTheDateTable) return
              setShowOnlyConfirmed(false)
              setShowOnlyUnconfirmed(false)
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Respuestas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rsvps.length}</div>
              <p className="text-xs text-muted-foreground">
                {isSaveTheDateTable
                  ? "Respuestas recibidas"
                  : !showOnlyConfirmed && !showOnlyUnconfirmed
                    ? "Mostrando todas · Clic para ver todas"
                    : "Personas que respondieron · Clic para ver todas"}
              </p>
            </CardContent>
          </Card>
          {!isSaveTheDateTable && (
            <>
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  showOnlyConfirmed
                    ? "ring-2 ring-green-500 ring-offset-2 dark:ring-offset-gray-900"
                    : ""
                }`}
                onClick={() => {
                  setShowOnlyConfirmed((prev) => !prev)
                  if (!showOnlyConfirmed) setShowOnlyUnconfirmed(false)
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
                  <Users className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{totalConfirmedCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {showOnlyConfirmed
                      ? "Mostrando solo confirmados · Clic para quitar filtro"
                      : "Asistirán al evento · Clic para filtrar"}
                  </p>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  showOnlyUnconfirmed
                    ? "ring-2 ring-red-500 ring-offset-2 dark:ring-offset-gray-900"
                    : ""
                }`}
                onClick={() => {
                  setShowOnlyUnconfirmed((prev) => !prev)
                  if (!showOnlyUnconfirmed) setShowOnlyConfirmed(false)
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">No Confirmados</CardTitle>
                  <Users className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{totalDeclinedCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {showOnlyUnconfirmed
                      ? "Mostrando solo no confirmados · Clic para quitar filtro"
                      : "No asistirán · Clic para filtrar"}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* RSVPs Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>
                  {isSaveTheDateTable ? "Respuestas Save the Date" : "Lista de Confirmaciones"}
                </CardTitle>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                {!isSaveTheDateTable && (
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Invitado
                </Button>
                )}
                {!isSaveTheDateTable && (
                <Button
                  variant="outline"
                  onClick={handleDownloadCSV}
                  disabled={filteredRsvps.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Lista
                </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            {rsvps.length > 0 && (
              <div className="mb-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={
                      isSaveTheDateTable
                        ? "Buscar en las respuestas..."
                        : "Buscar por nombre..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                  {!isSaveTheDateTable && (
                  <Button
                    variant={selectedFilterTags.length > 0 ? "default" : "outline"}
                    onClick={() => setIsFilterModalOpen(true)}
                    className="relative"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                    {selectedFilterTags.length > 0 && (
                      <span className="ml-2 bg-background text-foreground rounded-full px-1.5 py-0.5 text-xs font-medium">
                        {selectedFilterTags.length}
                      </span>
                    )}
                  </Button>
                  )}
                </div>
                {/* Mostrar etiquetas seleccionadas para filtrar */}
                {!isSaveTheDateTable && selectedFilterTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedFilterTags.map((tagId) => {
                      const tag = getTagById(tagId)
                      return tag ? (
                        <Badge
                          key={tagId}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {tag.name}
                          <button
                            onClick={() => {
                              setSelectedFilterTags((prev) =>
                                prev.filter((id) => String(id) !== String(tagId))
                              )
                            }}
                            className="ml-1 hover:bg-muted rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null
                    })}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFilterTags([])}
                      className="h-6 text-xs"
                    >
                      Limpiar filtros
                    </Button>
                  </div>
                )}
                {(searchQuery ||
                  (!isSaveTheDateTable &&
                    (showOnlyConfirmed || showOnlyUnconfirmed || selectedFilterTags.length > 0))) && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Mostrando {filteredRsvps.length} de {rsvps.length} resultados
                    {!isSaveTheDateTable && showOnlyConfirmed && " (solo confirmados)"}
                    {!isSaveTheDateTable && showOnlyUnconfirmed && " (solo no confirmados)"}
                    {!isSaveTheDateTable &&
                      selectedFilterTags.length > 0 &&
                      ` (filtrado por ${selectedFilterTags.length} etiqueta${selectedFilterTags.length > 1 ? "s" : ""})`}
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
                  onClick={handleRefresh}
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
                {/* Mobile View - Save the Date (solo columnas con datos útiles) */}
                {isSaveTheDateTable ? (
                  <div className="block md:hidden space-y-3">
                    {filteredRsvps.map((rsvp, index) => {
                      const rsvpId = rsvp.id || `rsvp-${index}`
                      const isExpanded = expandedRows.has(rsvpId)
                      return (
                        <Card
                          key={rsvpId}
                          className="cursor-pointer"
                          onClick={() => toggleRow(rsvpId)}
                        >
                          <CardContent className="p-4 py-0">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-base">
                                    Respuesta {index + 1}
                                  </p>
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
                                    {saveTheDateColumnKeys.map((key) => (
                                      <div key={key}>
                                        <p className="text-xs text-muted-foreground mb-1">
                                          {saveTheDateColumnLabel(key)}
                                        </p>
                                        <p className="text-sm break-words">
                                          {getSaveTheDateCellText(key, rsvp)}
                                        </p>
                                      </div>
                                    ))}
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
                ) : (
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
                                      <p className="text-sm">
                                        {formatFavoriteSongForDisplay(rsvp.favorite_song) || "—"}
                                      </p>
                                    </div>
                                  )}
                                  {hasEmail && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Email</p>
                                      <p className="text-sm break-all">
                                        {rsvp.email?.toString().trim()
                                          ? rsvp.email.toString().trim()
                                          : "—"}
                                      </p>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Etiquetas</p>
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setEditingTagsForRsvpMobile(rsvp.id || null)
                                      }}
                                      className="cursor-pointer"
                                    >
                                      {rsvp.tags && rsvp.tags.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {rsvp.tags.map((tagId) => {
                                            const tag = getTagById(tagId)
                                            return tag ? (
                                              <Badge
                                                key={tagId}
                                                style={{ backgroundColor: tag.color }}
                                                className="text-white border-0"
                                              >
                                                {tag.name}
                                              </Badge>
                                            ) : (
                                              <Badge
                                                key={tagId}
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                ID: {tagId}
                                              </Badge>
                                            )
                                          })}
                                        </div>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="mt-1 h-8 text-xs"
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
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <p className="text-xs text-muted-foreground mb-1">Mesa</p>
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenTableNumberDialog(rsvp, e)}
                                      className="w-20 h-8 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring text-center text-sm bg-transparent hover:bg-accent rounded cursor-pointer flex items-center justify-center"
                                    >
                                      {rsvp.table_number ?? "—"}
                                    </button>
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
                )}

                {/* Desktop View - Save the Date */}
                {isSaveTheDateTable ? (
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {saveTheDateColumnKeys.map((key) => (
                            <TableHead key={key}>{saveTheDateColumnLabel(key)}</TableHead>
                          ))}
                          <TableHead className="w-[100px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRsvps.map((rsvp, index) => (
                          <TableRow key={rsvp.id || index}>
                            {saveTheDateColumnKeys.map((key) => (
                              <TableCell key={key} className="max-w-xs truncate">
                                {getSaveTheDateCellText(key, rsvp)}
                              </TableCell>
                            ))}
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Asistencia</TableHead>
                        <TableHead>Preferencias Dietéticas</TableHead>
                        {hasFavoriteSong && <TableHead>Canción Favorita</TableHead>}
                        {hasEmail && <TableHead>Email</TableHead>}
                        <TableHead>Etiquetas</TableHead>
                        <TableHead>Mesa</TableHead>
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
                                {formatFavoriteSongForDisplay(rsvp.favorite_song) || "—"}
                              </TableCell>
                            )}
                            {hasEmail && (
                              <TableCell className="max-w-[200px] truncate text-sm" title={rsvp.email?.toString().trim() || undefined}>
                                {rsvp.email?.toString().trim() || "—"}
                              </TableCell>
                            )}
                            <TableCell>
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
                                          ) : (
                                            <Badge
                                              key={tagId}
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              ID: {tagId}
                                            </Badge>
                                          )
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
                                          // Comparar como strings para evitar problemas de tipo
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
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                onClick={(e) => handleOpenTableNumberDialog(rsvp, e)}
                                className="w-20 h-8 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring text-center bg-transparent hover:bg-accent rounded cursor-pointer flex items-center justify-center"
                              >
                                {rsvp.table_number ?? "—"}
                              </button>
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
                )}
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

        {/* Modal para filtrar por etiquetas */}
        <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Filtros por Etiquetas</DialogTitle>
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
                    const isSelected = selectedFilterTags.some(
                      (tagId) => String(tagId) === String(tag.id)
                    )
                    return (
                      <div
                        key={tag.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedFilterTags((prev) =>
                              prev.filter((id) => String(id) !== String(tag.id))
                            )
                          } else {
                            setSelectedFilterTags((prev) => [...prev, String(tag.id)])
                          }
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedFilterTags((prev) => [...prev, String(tag.id)])
                            } else {
                              setSelectedFilterTags((prev) =>
                                prev.filter((id) => String(id) !== String(tag.id))
                              )
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
                onClick={() => {
                  setSelectedFilterTags([])
                  setShowOnlyConfirmed(false)
                  setShowOnlyUnconfirmed(false)
                }}
                disabled={selectedFilterTags.length === 0 && !showOnlyConfirmed && !showOnlyUnconfirmed}
              >
                Limpiar Todo
              </Button>
              <Button onClick={() => setIsFilterModalOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
          tableNumbers={tableNumbers}
        />
      </div>
    </div>
  )
}
