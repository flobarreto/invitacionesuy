import { NextResponse } from "next/server"
import { verifyCredentials, setUserSession } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      )
    }

    const isValid = await verifyCredentials(username, password)

    if (!isValid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      )
    }

    await setUserSession(username)

    return NextResponse.json({ success: true, username })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Error al iniciar sesión" },
      { status: 500 }
    )
  }
}
