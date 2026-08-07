import assert from "node:assert/strict"
import test from "node:test"
import { parseCsv, previewGuestCsv } from "@/lib/crm/csv"
import { normalizePhone } from "@/lib/crm/phone"
import { stableHash } from "@/lib/crm/tokens"
import { manualGuestSchema } from "@/lib/crm/schemas"
import { decryptSecret, encryptSecret } from "@/lib/whatsapp/crypto"
import {
  SendPipelineError,
  classifySendFailure,
} from "@/lib/whatsapp/send-outcome"
import { validateWhatsAppDispatchSafety } from "@/lib/whatsapp/safety"
import {
  advanceReminder,
  initialReminderState,
  parseInboundCommand,
} from "@/lib/whatsapp/fsm"

test("normaliza teléfonos uruguayos a E.164", () => {
  assert.deepEqual(normalizePhone("099 123 456"), { ok: true, phoneE164: "+59899123456" })
  assert.deepEqual(normalizePhone("00598 99 123 456"), { ok: true, phoneE164: "+59899123456" })
  assert.deepEqual(normalizePhone("2400 1234"), { ok: true, phoneE164: "+59824001234" })
  assert.deepEqual(normalizePhone("+598 099 123 456"), { ok: false, reason: "invalid" })
  assert.deepEqual(normalizePhone("091 23 45"), { ok: false, reason: "invalid" })
  assert.deepEqual(normalizePhone("abc"), { ok: false, reason: "invalid" })
})

test("parsea CSV quoted, agrupa familias y conserva etiquetas", () => {
  const csv = [
    "nombre,telefono,grupo,etiquetas,consentimiento",
    '"Ana, María",099123456,Familia Pérez,"Familia|Amigos",sí',
    "Juan,099123456,Familia Pérez,Familia,sí",
  ].join("\n")
  assert.equal(parseCsv(csv)[1][0], "Ana, María")
  const preview = previewGuestCsv(csv)
  assert.equal(preview.invalidRows, 0)
  assert.equal(preview.validRows, 2)
  assert.equal(preview.groups, 1)
  assert.deepEqual(preview.rows[0].input?.labels, ["Familia", "Amigos"])
})

test("marca teléfonos repetidos cuando pertenecen a grupos distintos", () => {
  const preview = previewGuestCsv(
    "nombre,telefono,grupo,consentimiento\nAna,099123456,A,sí\nJuan,099123456,B,sí",
  )
  assert.equal(preview.invalidRows, 1)
  assert.equal(preview.rows[1].issues[0].code, "duplicate_phone")
})

test("CSV exige consentimiento declarado y nunca lo presume", () => {
  const preview = previewGuestCsv("nombre,telefono\nAna,099123456")
  assert.equal(preview.validRows, 0)
  assert.equal(preview.rows[0].issues[0].code, "invalid_consent")
})

test("CSV acepta BOM de Excel en el primer encabezado", () => {
  const preview = previewGuestCsv(
    "\uFEFFnombre,telefono,consentimiento\nAna,099123456,sí",
  )
  assert.equal(preview.validRows, 1)
})

test("alta manual exige consentimiento explícito y fuente no manipulable", () => {
  const base = {
    idempotencyKey: "manual-fixture-1",
    groupName: "Familia Pérez",
    phone: "099123456",
    members: [{ name: "Ana" }],
  }
  assert.equal(manualGuestSchema.safeParse({ ...base, consent: false }).success, true)
  assert.equal(manualGuestSchema.safeParse(base).success, false)
  assert.equal(
    manualGuestSchema.safeParse({
      ...base,
      consent: true,
      consentSource: "rsvp",
    }).success,
    false,
  )
})

test("FSM confirma cada integrante y recién después completa", () => {
  const guests = [
    { id: "ana", name: "Ana", attendanceStatus: "pending" as const },
    { id: "juan", name: "Juan", attendanceStatus: "pending" as const },
  ]
  const initial = initialReminderState(guests)
  const first = advanceReminder(initial, guests, parseInboundCommand("1"))
  assert.deepEqual(first.actions, [
    { type: "update_attendance", guestId: "ana", status: "attending" },
    { type: "ask_attendance", guestId: "juan" },
  ])

  const afterFirst = guests.map((guest) =>
    guest.id === "ana" ? { ...guest, attendanceStatus: "attending" as const } : guest,
  )
  const second = advanceReminder(first.state, afterFirst, parseInboundCommand("NO"))
  assert.equal(second.state.mode, "completed")
  assert.deepEqual(second.actions.at(-1), { type: "send_summary" })
})

test("FSM deriva a revisión tras tres respuestas inválidas", () => {
  const guests = [{ id: "ana", name: "Ana", attendanceStatus: "pending" as const }]
  let state = initialReminderState(guests)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    state = advanceReminder(state, guests, parseInboundCommand("tal vez")).state
  }
  assert.equal(state.mode, "review")
  assert.equal(state.invalidAttempts, 3)
})

test("FSM permite corregir un integrante luego de completar el recordatorio", () => {
  const guests = [
    { id: "ana", name: "Ana", attendanceStatus: "attending" as const },
    { id: "juan", name: "Juan", attendanceStatus: "declined" as const },
  ]
  const completed = initialReminderState(guests)
  assert.equal(completed.mode, "completed")

  const choose = advanceReminder(completed, guests, parseInboundCommand("CAMBIAR"))
  assert.equal(choose.state.mode, "awaiting_change_selection")
  assert.deepEqual(choose.actions, [{ type: "ask_change_selection" }])

  const selected = advanceReminder(choose.state, guests, parseInboundCommand("2"))
  assert.deepEqual(selected.actions, [{ type: "ask_attendance", guestId: "juan" }])

  const corrected = advanceReminder(selected.state, guests, parseInboundCommand("SÍ"))
  assert.equal(corrected.state.mode, "completed")
  assert.deepEqual(corrected.actions, [
    { type: "update_attendance", guestId: "juan", status: "attending" },
    { type: "send_summary" },
  ])
})

test("FSM convierte BAJA y STOP en una supresión sin cambiar asistencias", () => {
  const guests = [{ id: "ana", name: "Ana", attendanceStatus: "pending" as const }]
  for (const input of ["BAJA", "stop"] as const) {
    const transition = advanceReminder(
      initialReminderState(guests),
      guests,
      parseInboundCommand(input),
    )
    assert.equal(transition.state.mode, "completed")
    assert.deepEqual(transition.actions, [{ type: "suppress" }])
  }
})

test("cifrado autenticado redondea y detecta una clave incorrecta", () => {
  const key = "clave-principal-de-prueba-con-32-bytes"
  const encrypted = encryptSecret("secreto", key)
  assert.equal(decryptSecret(encrypted, key), "secreto")
  assert.throws(() => decryptSecret(encrypted, "otra-clave-de-prueba-con-32-bytes"))
  assert.throws(() => encryptSecret("secreto", "clave-corta"))
})

test("hash estable no depende del orden de propiedades", () => {
  assert.equal(stableHash({ b: 2, a: 1 }), stableHash({ a: 1, b: 2 }))
})

test("solo reintenta fallos comprobablemente anteriores al envío", () => {
  assert.deepEqual(classifySendFailure(new Error("OUTBOUND_CONTEXT:db")), {
    providerAttempted: false,
    retryable: true,
  })
  assert.deepEqual(classifySendFailure(new Error("invalid ciphertext")), {
    providerAttempted: false,
    retryable: false,
  })
  assert.deepEqual(
    classifySendFailure(new SendPipelineError(new Error("PROVIDER_DISCONNECTED"), false)),
    { providerAttempted: false, retryable: true },
  )
})

test("un timeout posterior al intento queda incierto y nunca se reenvía", () => {
  assert.deepEqual(
    classifySendFailure(new SendPipelineError(new Error("PROVIDER_TIMEOUT"), true)),
    { providerAttempted: true, retryable: false },
  )
})

test("la configuración nunca puede acelerar el envío ni superar 200 por hora", () => {
  assert.deepEqual(
    validateWhatsAppDispatchSafety({
      minDelayMs: 8_000,
      maxDelayMs: 15_000,
      hourlyLimit: 200,
    }),
    { minDelayMs: 8_000, maxDelayMs: 15_000, hourlyLimit: 200 },
  )
  assert.throws(() => validateWhatsAppDispatchSafety({
    minDelayMs: 7_999,
    maxDelayMs: 15_000,
    hourlyLimit: 200,
  }))
  assert.throws(() => validateWhatsAppDispatchSafety({
    minDelayMs: 8_000,
    maxDelayMs: 15_000,
    hourlyLimit: 201,
  }))
})
