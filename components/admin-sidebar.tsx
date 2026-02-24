"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LogOut, Menu, Home, Tag, Users, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface AdminSidebarProps {
  username: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function AdminSidebar({
  username,
  collapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" })
      router.push("/admin/login")
      router.refresh()
    } catch (err) {
      console.error("Logout error:", err)
    }
  }

  const menuItems = [
    { href: "/admin", label: "Inicio", icon: Home },
    { href: "/admin/tags", label: "Etiquetas", icon: Tag },
    { href: "/admin/tables", label: "Mesas", icon: Users },
  ]

  const MenuContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className={cn("border-b bg-background", collapsed ? "p-2" : "p-4")}>
        {!collapsed && (
          <>
            <h2 className="text-lg font-semibold">Panel de Administración</h2>
            <p className="text-sm text-muted-foreground truncate">{username}</p>
          </>
        )}
      </div>
      <nav className={cn("flex-1 space-y-2", collapsed ? "p-2" : "p-4")}>
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center p-2" : "gap-3 px-3 py-2",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
      <div className={cn("border-t", collapsed ? "p-2" : "p-4")}>
        {!collapsed && (
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        )}
        {collapsed && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleLogout}
            className="w-full"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="w-full mt-2"
            title={collapsed ? "Expandir menú" : "Achicar menú"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:border-r md:bg-background md:z-30 transition-[width] duration-200",
          collapsed ? "md:w-16" : "md:w-64"
        )}
      >
        <MenuContent />
      </aside>

      {/* Mobile Hamburger Menu */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
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
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
              <div className="p-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full justify-start"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
