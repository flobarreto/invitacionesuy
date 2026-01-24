"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LogOut, Menu, Home, Tag } from "lucide-react"
import { cn } from "@/lib/utils"

interface AdminSidebarProps {
  username: string
}

export default function AdminSidebar({ username }: AdminSidebarProps) {
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
    {
      href: "/admin",
      label: "Inicio",
      icon: Home,
    },
    {
      href: "/admin/tags",
      label: "Etiquetas",
      icon: Tag,
    },
  ]

  const MenuContent = () => (
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
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 md:left-0 md:border-r md:bg-background">
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
            <MenuContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
