import type { InvitationDefinition } from "@/lib/invitations/types"

function calendarRange(definition: InvitationDefinition) {
  const start = definition.event.startsAt ? new Date(definition.event.startsAt) : null
  const preset = definition.calendar
  if (!start || Number.isNaN(start.getTime())) return null
  return {
    preset,
    start,
    end: new Date(start.getTime() + preset.durationMinutes * 60_000),
  }
}

function googleTimestamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

export function buildGoogleCalendarUrl(definition: InvitationDefinition): string {
  const range = calendarRange(definition)
  if (!range) return "#"
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: range.preset.title,
    dates: `${googleTimestamp(range.start)}/${googleTimestamp(range.end)}`,
    details: range.preset.details,
  })
  if (range.preset.location) query.set("location", range.preset.location)
  return `https://calendar.google.com/calendar/render?${query.toString()}`
}

function escapeIcs(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
}

export function buildInvitationIcs(definition: InvitationDefinition): string | null {
  const range = calendarRange(definition)
  if (!range) return null
  const timestamp = googleTimestamp(new Date())
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Invitia//Invitación de boda//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTAMP:${timestamp}`,
    `UID:${definition.id}-${googleTimestamp(range.start)}@invitia.uy`,
    `SUMMARY:${escapeIcs(range.preset.title)}`,
    `DESCRIPTION:${escapeIcs(range.preset.details)}`,
    `DTSTART:${googleTimestamp(range.start)}`,
    `DTEND:${googleTimestamp(range.end)}`,
    ...(range.preset.location ? [`LOCATION:${escapeIcs(range.preset.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
  return lines.join("\r\n")
}
