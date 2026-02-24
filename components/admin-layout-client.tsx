"use client"

import { useState, useEffect } from "react"
import AdminSidebar from "@/components/admin-sidebar"

const STORAGE_KEY = "admin-sidebar-collapsed"

export default function AdminLayoutClient({
  username,
  children,
}: {
  username: string
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setCollapsed(true)
    } catch {}
  }, [])

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {}
      return next
    })
  }

  return (
    <div className="flex min-h-screen w-full">
      <AdminSidebar
        username={username}
        collapsed={collapsed}
        onToggleCollapse={handleToggle}
      />
      <main
        className="flex-1 min-h-screen overflow-auto transition-[margin] duration-200"
        style={{ marginLeft: collapsed ? "4rem" : "16rem" }}
      >
        {children}
      </main>
    </div>
  )
}
