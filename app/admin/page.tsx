import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import AdminDashboard from "@/components/admin-dashboard"

export default async function AdminPage() {
  const username = await getCurrentUser()

  if (!username) {
    redirect("/admin/login")
  }

  return <AdminDashboard username={username} />
}
