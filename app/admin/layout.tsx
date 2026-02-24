import { getCurrentUser } from "@/lib/auth"
import AdminLayoutClient from "@/components/admin-layout-client"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const username = await getCurrentUser()

  if (!username) {
    return <>{children}</>
  }

  return <AdminLayoutClient username={username}>{children}</AdminLayoutClient>
}
