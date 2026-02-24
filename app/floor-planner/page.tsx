"use client"

import { FloorPlanner } from "@/components/floor-planner/FloorPlanner"

/**
 * Demo page for the Floor Planner.
 * Persistencia real: en producción podés cargar initialLayout desde tu API/DB
 * (ej: GET /api/venues/[venueId]/layout o por eventId) y guardar con POST/PUT
 * al hacer "Guardar JSON" o un botón "Guardar en servidor".
 */
export default function FloorPlannerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto space-y-4">
        <header>
          <h1 className="text-2xl font-bold text-foreground">Plano de mesas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Arrastrá mesas, usá la rueda para zoom y Space + arrastre para pan. Delete para borrar, Ctrl+D duplicar.
          </p>
        </header>
        <FloorPlanner venueId="demo" stageWidth={1200} stageHeight={700} />
      </div>
    </div>
  )
}
