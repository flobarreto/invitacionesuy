-- Tabla para guardar el plano de mesas por evento (table_name del admin).
-- Un registro por evento: mesas, posiciones, fondo, dimensiones del plano.
CREATE TABLE IF NOT EXISTS floor_plan (
  table_name TEXT PRIMARY KEY,
  layout JSONB NOT NULL DEFAULT '{"venueId":"","width":800,"height":600,"tables":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE floor_plan IS 'Plano de mesas (Floor Planner) por evento; layout es un VenueLayout en JSON.';
