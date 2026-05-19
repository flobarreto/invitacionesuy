import { getCurrentUser, getUserTableName } from "@/lib/auth"
import AdminSidebar from "@/components/admin-sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const username = await getCurrentUser()

  if (!username) {
    return <>{children}</>
  }

  const tableName = await getUserTableName(username)
  const isSaveTheDate = (tableName ?? "").toLowerCase().includes("save_the_date")

  return (
    <div className="flex min-h-screen">
      <AdminSidebar username={username} isSaveTheDate={isSaveTheDate} />
      <main className="flex-1 md:ml-64">{children}</main>
    </div>
  )
}
