"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LogOut, Menu, Home, Tag, Users, Wine, Download, Music, MessageCircle, Map } from "lucide-react"
import { cn } from "@/lib/utils"
import { downloadSongsCsv } from "@/lib/adminSongs"

interface AdminSidebarProps {
  username: string
  isSaveTheDate?: boolean
}

export default function AdminSidebar({
  username,
  isSaveTheDate = false,
}: AdminSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hasSongs, setHasSongs] = useState(false)
  const [tableName, setTableName] = useState("")
  const [eventId, setEventId] = useState("")
  const [legacyCutover, setLegacyCutover] = useState(false)
  const [downloadingSongs, setDownloadingSongs] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch("/api/admin/meta")
        const data = await response.json() as {
          code?: string
          redirectTo?: string
          eventId?: string
          tableName?: string
          hasSongs?: boolean
          legacyCutover?: boolean
          canonicalAdminUrl?: string
        }
        if (cancelled) return
        if (
          response.status === 409 &&
          data.code === "LEGACY_CUTOVER_COMPLETE" &&
          data.redirectTo &&
          data.eventId
        ) {
          setLegacyCutover(true)
          setEventId(data.eventId)
          if (!pathname.startsWith(`/admin/events/${data.eventId}/`)) {
            router.replace(data.redirectTo)
          }
          return
        }
        if (!response.ok) return
        const isCutover = data.legacyCutover === true
        setLegacyCutover(isCutover)
        setTableName(data.tableName ?? username)
        setEventId(data.eventId ?? "")
        setHasSongs(Boolean(data.hasSongs))
        if (
          isCutover &&
          data.eventId &&
          data.canonicalAdminUrl &&
          !pathname.startsWith(`/admin/events/${data.eventId}/`)
        ) {
          router.replace(data.canonicalAdminUrl)
        }
      } catch {
        if (!cancelled) setHasSongs(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [pathname, router, username])

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError(null)
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        setLogoutError(body?.error ?? "No se pudo cerrar la sesión. Intentá nuevamente.")
        return
      }
      router.push("/admin/login")
      router.refresh()
    } catch {
      setLogoutError("No se pudo cerrar la sesión. Revisá tu conexión e intentá nuevamente.")
    } finally {
      setLoggingOut(false)
    }
  }

  const handleDownloadSongs = async () => {
    setDownloadingSongs(true)
    try {
      const response = await fetch(
        legacyCutover && eventId
          ? `/api/admin/events/${eventId}/guests`
          : "/api/admin/rsvps",
      )
      const data = await response.json()
      if (!response.ok) return
      const songRows = legacyCutover
        ? (data.groups ?? []).flatMap(
            (group: { guests?: Array<{ favoriteSong?: unknown }> }) =>
              (group.guests ?? []).map((guest) => ({
                favorite_song: guest.favoriteSong,
              })),
          )
        : data.rsvps ?? []
      downloadSongsCsv(songRows, data.tableName ?? tableName ?? username)
    } catch {
      console.error("Unable to download songs CSV")
    } finally {
      setDownloadingSongs(false)
      setIsMobileMenuOpen(false)
    }
  }

  const canonicalHome = eventId ? `/admin/events/${eventId}/crm` : "/admin"
  const menuItems = [
    { href: legacyCutover ? canonicalHome : "/admin", label: "Inicio", icon: Home },
    ...(eventId
      ? [
          { href: `/admin/events/${eventId}/crm`, label: "CRM y WhatsApp", icon: MessageCircle },
          { href: `/admin/events/${eventId}/seating`, label: "Plano de mesas", icon: Map },
        ]
      : []),
    ...(!legacyCutover && isSaveTheDate
      ? [{ href: "/admin/bebidas", label: "Bebidas", icon: Wine }]
      : !legacyCutover ? [
          { href: "/admin/tags", label: "Etiquetas", icon: Tag },
          ...(!eventId ? [{ href: "/admin/tables", label: "Mesas", icon: Users }] : []),
        ] : []),
  ]

  const menuContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Panel de Administración</h2>
        <p className="text-sm text-muted-foreground">{username}</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}

        {hasSongs && (
          <button
            type="button"
            onClick={() => void handleDownloadSongs()}
            disabled={downloadingSongs}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              downloadingSongs && "opacity-60 pointer-events-none",
            )}
          >
            {downloadingSongs ? (
              <Download className="h-4 w-4 animate-pulse" />
            ) : (
              <Music className="h-4 w-4" />
            )}
            Descargar lista de canciones
          </button>
        )}
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="outline"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full justify-start"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {loggingOut ? "Cerrando sesión…" : "Cerrar Sesión"}
        </Button>
        {logoutError ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {logoutError}
          </p>
        ) : null}
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 md:left-0 md:border-r md:bg-background">
        {menuContent}
      </aside>

      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            {menuContent}
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
