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
import { LogOut, RefreshCw, Users, Download, Search, ChevronDown, ChevronUp } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

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
  const [searchQuery, setSearchQuery] = useState("")
  const [showOnlyConfirmed, setShowOnlyConfirmed] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

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
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRSVPs()
  }, [])

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" })
      router.push("/admin/login")
      router.refresh()
    } catch (err) {
      console.error("Logout error:", err)
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

  const formatTableName = (tableName: string) => {
    return tableName
      .replace(/_rsvps$/i, "") // Eliminar "_rsvps" al final
      .replace(/rsvps_/i, "") // Eliminar "rsvps_" al inicio
      .replace(/_rsvps_/i, "_") // Eliminar "_rsvps_" en el medio
      .replace(/\brsvps\b/i, "") // Eliminar "rsvps" como palabra completa
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim()
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
          : "Ninguna"
        
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Evento: {formatTableName(tableName)}
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
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
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
                  Todas las respuestas recibidas para este evento
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center space-x-2">
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
                              <p className="font-medium text-base">{rsvp.name}</p>
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
                                        : "Ninguna"}
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
                                : "Ninguna"}
                            </TableCell>
                            {hasFavoriteSong && (
                              <TableCell className="max-w-xs truncate">
                                {rsvp.favorite_song || "—"}
                              </TableCell>
                            )}
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(rsvp.created_at)}
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
      </div>
    </div>
  )
}
