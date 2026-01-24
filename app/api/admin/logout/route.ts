import { NextResponse } from "next/server"
import { clearUserSession } from "@/lib/auth"

export async function POST() {
  try {
    await clearUserSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json(
      { error: "Error al cerrar sesión" },
      { status: 500 }
    )
  }
}
