import { getCurrentUser } from "@/lib/auth"
import AdminSidebar from "@/components/admin-sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const username = await getCurrentUser()

  // Si no hay usuario autenticado, renderizar sin sidebar (para la página de login)
  if (!username) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar username={username} />
      <main className="flex-1 md:ml-64">
        {children}
      </main>
    </div>
  )
}
