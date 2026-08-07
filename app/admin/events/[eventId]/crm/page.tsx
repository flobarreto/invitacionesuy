import { requireEventAccess } from "@/lib/auth"
import { EventCrm } from "@/components/crm/event-crm"

type PageProps = { params: Promise<{ eventId: string }> }

export default async function EventCrmPage({ params }: PageProps) {
  const { eventId } = await params
  await requireEventAccess(eventId)
  return <EventCrm eventId={eventId} />
}

