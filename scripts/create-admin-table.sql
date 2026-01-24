-- Script SQL para crear la tabla admin en Supabase
-- Ejecuta este script en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS admin (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  table_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas por username
CREATE INDEX IF NOT EXISTS idx_admin_username ON admin(username);

-- Comentarios para documentación
COMMENT ON TABLE admin IS 'Tabla de administradores con credenciales hasheadas';
COMMENT ON COLUMN admin.username IS 'Nombre de usuario único para login';
COMMENT ON COLUMN admin.password IS 'Contraseña hasheada con bcrypt';
COMMENT ON COLUMN admin.table_name IS 'Nombre de la tabla de RSVPs que puede ver este admin (opcional, por defecto usa username)';
