export function invitationMessage(input: {
  coupleName: string
  groupName: string
  invitationUrl: string
  customMessage?: string | null
}) {
  const intro = input.customMessage?.trim() || `¡${input.coupleName} se casan! 💍`
  return [
    `Hola ${input.groupName} 👋`,
    intro,
    "Nos encantaría compartir este día con ustedes.",
    `Pueden ver la invitación y confirmar asistencia acá: ${input.invitationUrl}`,
  ].join("\n\n")
}

export function reminderQuestion(input: {
  groupName: string
  guestName: string
  coupleName: string
  customMessage?: string | null
}) {
  return [
    input.customMessage?.trim() || `Hola ${input.groupName} 👋 Somos el asistente de ${input.coupleName}.`,
    `Todavía nos falta confirmar a ${input.guestName}. ¿Asiste?`,
    "Respondé *1* o *SÍ* para confirmar, o *2* o *NO* para rechazar.",
    "También podés responder *CAMBIAR* para corregir una respuesta anterior o *BAJA* para no recibir más mensajes.",
  ].join("\n\n")
}

export function reminderSummary(input: {
  coupleName: string
  guests: Array<{ name: string; attendanceStatus: "pending" | "attending" | "declined" }>
  invitationUrl: string
}) {
  const icon = (status: "pending" | "attending" | "declined") =>
    status === "attending" ? "✅" : status === "declined" ? "❌" : "⏳"
  const summary = input.guests.map((guest) => `${icon(guest.attendanceStatus)} ${guest.name}`).join("\n")
  return [
    `¡Gracias! Así quedó la confirmación para ${input.coupleName}:`,
    summary,
    `Pueden completar dieta, bebida o canción desde la invitación: ${input.invitationUrl}`,
  ].join("\n\n")
}

export function tableNoticeMessage(input: {
  groupName: string
  coupleName: string
  customMessage?: string | null
  guests: Array<{ name: string; tableLabel: string }>
}) {
  const assignments = input.guests.map((guest) => `• ${guest.name}: mesa ${guest.tableLabel}`).join("\n")
  return [
    `Hola ${input.groupName} 💛`,
    input.customMessage?.trim() || `${input.coupleName} ya están contando las horas para celebrar con ustedes.`,
    "Estas son sus mesas:",
    assignments,
    "¡Nos vemos muy pronto! ✨",
  ].join("\n\n")
}

export const optOutConfirmation =
  "Listo, no enviaremos más mensajes a este número. Si fue un error, escribile directamente a los novios."
