import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error("Supabase admin client not configured")
    return false
  }

  try {
    // Buscar el usuario en la tabla admin
    const { data, error } = await supabaseAdmin
      .from("admin")
      .select("username, password, table_name")
      .eq("username", username)
      .single()

    if (error || !data) {
      console.error("Error fetching admin user:", error)
      return false
    }

    // Verificar la contraseña hasheada
    const isValid = await bcrypt.compare(password, data.password)
    return isValid
  } catch (error) {
    console.error("Error verifying credentials:", error)
    return false
  }
}

export async function getCurrentUser(): Promise<string | null> {
  const cookieStore = await cookies()
  const username = cookieStore.get("admin_username")?.value
  return username || null
}

export async function getUserTableName(username: string): Promise<string | null> {
  if (!supabaseAdmin) {
    return null
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("admin")
      .select("table_name")
      .eq("username", username)
      .single()

    if (error || !data) {
      console.error("Error fetching user table name:", error)
      // Si no hay table_name, usar el username como fallback
      return username
    }

    // Si hay table_name, usarlo; si no, usar el username
    return data.table_name || username
  } catch (error) {
    console.error("Error getting user table name:", error)
    return username
  }
}

export async function setUserSession(username: string) {
  const cookieStore = await cookies()
  cookieStore.set("admin_username", username, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  })
}

export async function clearUserSession() {
  const cookieStore = await cookies()
  cookieStore.delete("admin_username")
}

export async function requireAuth(): Promise<string> {
  const username = await getCurrentUser()
  if (!username) {
    throw new Error("Unauthorized")
  }
  return username
}

export async function requireAuthWithTable(): Promise<{ username: string; tableName: string }> {
  const username = await requireAuth()
  const tableName = await getUserTableName(username)
  return {
    username,
    tableName: tableName || username,
  }
}
