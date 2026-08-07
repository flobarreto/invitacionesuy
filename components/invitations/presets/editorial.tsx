import type { InvitationDefinition } from "@/lib/invitations/types"
import { buildGoogleCalendarUrl } from "@/lib/invitations/calendar"

export default function EditorialInvitation({
  definition,
}: {
  definition: InvitationDefinition
}) {
  const startsAt = definition.event.startsAt
    ? new Intl.DateTimeFormat("es-UY", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: definition.event.timezone,
      }).format(new Date(definition.event.startsAt))
    : "Fecha a confirmar"
  const calendarUrl = buildGoogleCalendarUrl(definition)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4efe7] px-6 text-[#29251f]">
      <section className="w-full max-w-3xl border border-[#29251f]/30 px-8 py-20 text-center md:px-16">
        <p className="mb-8 text-xs uppercase tracking-[0.4em]">Nos casamos</p>
        <h1 className="font-serif text-5xl md:text-7xl">
          {definition.coupleNames}
        </h1>
        <div className="mx-auto my-10 h-px w-24 bg-[#29251f]/50" />
        <p className="capitalize">{startsAt}</p>
        {definition.capabilities.calendar && calendarUrl !== "#" ? (
          <a
            className="mt-8 inline-flex border border-[#29251f] px-5 py-2 text-sm uppercase tracking-[0.2em]"
            href={calendarUrl}
            target="_blank"
            rel="noreferrer"
          >
            Agendar
          </a>
        ) : null}
      </section>
    </main>
  )
}
