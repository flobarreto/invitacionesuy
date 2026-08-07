import { SeatingPlanner } from "@/components/seating/seating-planner"
import { requireEventAccess } from "@/lib/auth"

export default async function EventSeatingPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  await requireEventAccess(eventId)
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 pt-16 dark:from-gray-900 dark:to-gray-800 md:p-8 md:pt-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div>
          <h1 className="text-3xl font-bold">Plano y mesas</h1>
          <p className="mt-1 text-muted-foreground">
            Diseñá el salón y asigná invitados usando una única fuente de verdad.
          </p>
        </div>
        <SeatingPlanner eventId={eventId} />
      </div>
    </div>
  )
}
