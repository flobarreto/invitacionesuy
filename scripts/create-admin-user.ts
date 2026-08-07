/**
 * Script para crear usuarios admin en la tabla admin
 * 
 * Uso:
 * npx tsx scripts/create-admin-user.ts <username> <password> <table_name>
 * 
 * Ejemplo:
 * npx tsx scripts/create-admin-user.ts boda_vir_jere miPassword123 boda_vir_jere
 */

import bcrypt from "bcryptjs"
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"
import { ADMIN_PASSWORD_BCRYPT_ROUNDS } from "../lib/auth-password"

// Cargar variables de entorno desde .env.local o .env
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados")
  console.error("")
  console.error("Asegúrate de tener un archivo .env.local o .env en la raíz del proyecto con:")
  console.error("  SUPABASE_URL=tu_url_de_supabase")
  console.error("  SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key")
  console.error("")
  console.error("Puedes encontrar estas variables en tu dashboard de Supabase:")
  console.error("  Settings > API > Project URL (SUPABASE_URL)")
  console.error("  Settings > API > service_role key (SUPABASE_SERVICE_ROLE_KEY)")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
})

async function createAdminUser(username: string, password: string, tableName?: string) {
  try {
    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(
      password,
      ADMIN_PASSWORD_BCRYPT_ROUNDS,
    )

    // Insertar en la tabla admin
    const { data, error } = await supabase
      .from("admin")
      .insert({
        username,
        password: hashedPassword,
        table_name: tableName || username,
      })
      .select()

    if (error) {
      console.error("Error creando usuario admin:", error)
      process.exit(1)
    }

    console.log("✅ Usuario admin creado exitosamente:")
    console.log(`   Username: ${username}`)
    console.log(`   Table Name: ${tableName || username}`)
    console.log(`   ID: ${data?.[0]?.id}`)
  } catch (error) {
    console.error("Error inesperado:", error)
    process.exit(1)
  }
}

// Obtener argumentos de la línea de comandos
const args = process.argv.slice(2)

if (args.length < 2) {
  console.error("Uso: npx tsx scripts/create-admin-user.ts <username> <password> [table_name]")
  console.error("")
  console.error("Ejemplo:")
  console.error("  npx tsx scripts/create-admin-user.ts boda_vir_jere miPassword123 boda_vir_jere")
  process.exit(1)
}

const [username, password, tableName] = args

if (!username || !password) {
  console.error("Error: username y password son requeridos")
  process.exit(1)
}

createAdminUser(username, password, tableName)
