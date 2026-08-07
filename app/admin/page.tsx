import { redirect } from "next/navigation"
import {
  getCurrentUser,
  getLegacyAdminTransitionPayload,
  requireAuthWithTable,
} from "@/lib/auth"
import AdminDashboard from "@/components/admin-dashboard"

export default async function AdminPage() {
  const username = await getCurrentUser()

  if (!username) {
    redirect("/admin/login")
  }

  let canonicalDestination: string | null = null
  try {
    await requireAuthWithTable()
  } catch (error) {
    const transition = getLegacyAdminTransitionPayload(error)
    if (!transition) throw error
    canonicalDestination = transition.redirectTo
  }
  if (canonicalDestination) redirect(canonicalDestination)

  return <AdminDashboard username={username} />
}
