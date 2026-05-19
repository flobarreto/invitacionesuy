"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, Wine } from "lucide-react"
import { computeDrinkCounts, parseDrinksFromValue } from "@/lib/adminDrinks"

interface RSVP {
  drink?: unknown
}

export default function BebidasPage() {
  const router = useRouter()
  const [rsvps, setRsvps] = useState<RSVP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tableName, setTableName] = useState("")
  const [eventName, setEventName] = useState<string | null>(null)

  const isSaveTheDateTable = tableName.toLowerCase().includes("save_the_date")

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
        setError(data.error || "Error al cargar las respuestas")
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

  useEffect(() => {
    void fetchRSVPs()
  }, [])

  const drinkCounts = useMemo(() => computeDrinkCounts(rsvps), [rsvps])
  const drinkTotal = useMemo(
    () => Object.values(drinkCounts).reduce((a, b) => a + b, 0),
    [drinkCounts],
  )

  const guestsWithDrinksCount = useMemo(
    () =>
      rsvps.filter((rsvp) => parseDrinksFromValue(rsvp.drink).length > 0).length,
    [rsvps],
  )

  const sortedDrinkEntries = useMemo(
    () => Object.entries(drinkCounts).sort((a, b) => b[1] - a[1]),
    [drinkCounts],
  )

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 pt-16 md:pt-8 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Bebidas</h1>
            {eventName && (
              <p className="text-muted-foreground mt-1">{eventName}</p>
            )}
          </div>
          <Button variant="outline" onClick={() => void fetchRSVPs()} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
        </div>

        {!isSaveTheDateTable && !loading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              El resumen de bebidas está disponible solo para eventos Save the
              Date.
            </CardContent>
          </Card>
        )}

        {isSaveTheDateTable && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Cargando...</span>
              </div>
            ) : error ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                  <Button
                    variant="outline"
                    onClick={() => void fetchRSVPs()}
                    className="mt-4"
                  >
                    Reintentar
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total selecciones
                    </CardTitle>
                    <Wine className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{drinkTotal}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {guestsWithDrinksCount} invitado
                      {guestsWithDrinksCount === 1 ? "" : "s"} con bebida
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Bebidas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sortedDrinkEntries.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">
                        No hay bebidas registradas todavía.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {sortedDrinkEntries.map(([drink, count]) => (
                          <li
                            key={drink}
                            className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                          >
                            <span className="font-medium capitalize">{drink}</span>
                            <span className="text-2xl font-bold tabular-nums">
                              {count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
