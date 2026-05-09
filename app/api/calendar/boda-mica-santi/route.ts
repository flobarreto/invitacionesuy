import { NextResponse } from "next/server"

/** Misma franja que Google Calendar (Montevideo 17 oct 2026 18:00 → 18 oct 03:00), en UTC (UY UTC−3, sin DST). */
const ICS_BODY = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//invitacionesuy//ES",
  "CALSCALE:GREGORIAN",
  "BEGIN:VEVENT",
  "DTSTAMP:20260509T120000Z",
  "UID:boda-mica-santi-2026@invitacionesuy",
  "SUMMARY:Boda Mica & Santi",
  "DESCRIPTION:¡Guardate la fecha de nuestro casamiento para que no te olvides y puedas compartir con nosotros!",
  "DTSTART:20261017T210000Z",
  "DTEND:20261018T060000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n")

/**
 * Sirve un evento .ics por HTTPS. En iOS, Safari suele pasar esto a Calendario;
 * un data: URL suele mostrar “descargar” en lugar del flujo nativo.
 */
export async function GET() {
  return new NextResponse(ICS_BODY, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
