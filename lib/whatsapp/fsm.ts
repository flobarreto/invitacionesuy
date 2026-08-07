import type { AttendanceStatus } from "@/lib/crm/types"

export type InboundCommand =
  | { type: "accept" }
  | { type: "decline" }
  | { type: "change" }
  | { type: "select"; index: number }
  | { type: "stop" }
  | { type: "unknown" }

export interface ReminderGuest {
  id: string
  name: string
  attendanceStatus: AttendanceStatus
}

export interface ReminderState {
  mode: "awaiting_attendance" | "awaiting_change_selection" | "completed" | "review"
  currentGuestId: string | null
  invalidAttempts: number
}

export type ReminderAction =
  | { type: "update_attendance"; guestId: string; status: "attending" | "declined" }
  | { type: "ask_attendance"; guestId: string }
  | { type: "ask_change_selection" }
  | { type: "send_summary" }
  | { type: "mark_review" }
  | { type: "suppress" }

export function parseInboundCommand(text: string): InboundCommand {
  const normalized = text
    .trim()
    .toLocaleUpperCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.!¡¿?]/g, "")

  if (["BAJA", "STOP", "CANCELAR", "SALIR"].includes(normalized)) return { type: "stop" }
  if (/^\d+$/.test(normalized)) return { type: "select", index: Number(normalized) - 1 }
  if (["SI", "S", "VOY", "CONFIRMO"].includes(normalized)) return { type: "accept" }
  if (["NO", "N", "NO VOY", "RECHAZO"].includes(normalized)) return { type: "decline" }
  if (["CAMBIAR", "CORREGIR", "MODIFICAR"].includes(normalized)) return { type: "change" }
  return { type: "unknown" }
}

export function initialReminderState(guests: ReminderGuest[]): ReminderState {
  return {
    mode: guests.some((guest) => guest.attendanceStatus === "pending")
      ? "awaiting_attendance"
      : "completed",
    currentGuestId: guests.find((guest) => guest.attendanceStatus === "pending")?.id ?? null,
    invalidAttempts: 0,
  }
}

export function advanceReminder(
  state: ReminderState,
  guests: ReminderGuest[],
  command: InboundCommand,
): { state: ReminderState; actions: ReminderAction[] } {
  if (command.type === "stop") {
    return {
      state: { ...state, mode: "completed" },
      actions: [{ type: "suppress" }],
    }
  }

  if (command.type === "change") {
    return {
      state: { mode: "awaiting_change_selection", currentGuestId: null, invalidAttempts: 0 },
      actions: [{ type: "ask_change_selection" }],
    }
  }

  if (state.mode === "awaiting_change_selection") {
    if (command.type === "select" && guests[command.index]) {
      return {
        state: {
          mode: "awaiting_attendance",
          currentGuestId: guests[command.index].id,
          invalidAttempts: 0,
        },
        actions: [{ type: "ask_attendance", guestId: guests[command.index].id }],
      }
    }
    return invalidTransition(state)
  }

  if (state.mode !== "awaiting_attendance" || !state.currentGuestId) {
    return invalidTransition(state)
  }
  const attendanceCommand =
    command.type === "select" && command.index === 0
      ? "accept"
      : command.type === "select" && command.index === 1
        ? "decline"
        : command.type
  if (attendanceCommand !== "accept" && attendanceCommand !== "decline") {
    return invalidTransition(state)
  }

  const status = attendanceCommand === "accept" ? "attending" : "declined"
  const nextGuest = guests.find(
    (guest) => guest.id !== state.currentGuestId && guest.attendanceStatus === "pending",
  )
  const actions: ReminderAction[] = [
    { type: "update_attendance", guestId: state.currentGuestId, status },
  ]

  if (nextGuest) {
    actions.push({ type: "ask_attendance", guestId: nextGuest.id })
    return {
      state: { mode: "awaiting_attendance", currentGuestId: nextGuest.id, invalidAttempts: 0 },
      actions,
    }
  }

  actions.push({ type: "send_summary" })
  return {
    state: { mode: "completed", currentGuestId: null, invalidAttempts: 0 },
    actions,
  }
}

function invalidTransition(state: ReminderState) {
  const invalidAttempts = state.invalidAttempts + 1
  if (invalidAttempts >= 3) {
    return {
      state: { ...state, mode: "review" as const, invalidAttempts },
      actions: [{ type: "mark_review" as const }],
    }
  }
  return { state: { ...state, invalidAttempts }, actions: [] }
}
