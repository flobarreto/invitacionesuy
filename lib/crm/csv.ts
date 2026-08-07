import { normalizePhone } from "@/lib/crm/phone"
import type {
  GuestImportIssue,
  GuestImportPreview,
  GuestImportPreviewRow,
} from "@/lib/crm/types"

const HEADER_ALIASES: Record<string, "name" | "phone" | "labels" | "groupKey" | "consent"> = {
  name: "name",
  nombre: "name",
  invitado: "name",
  phone: "phone",
  telefono: "phone",
  teléfono: "phone",
  celular: "phone",
  whatsapp: "phone",
  label: "labels",
  labels: "labels",
  etiqueta: "labels",
  etiquetas: "labels",
  group: "groupKey",
  group_key: "groupKey",
  grupo: "groupKey",
  familia: "groupKey",
  consent: "consent",
  consentimiento: "consent",
}

export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    const next = input[index + 1]

    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }

    if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ",") {
      row.push(field.trim())
      field = ""
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && next === "\n") index += 1
      row.push(field.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ""
    } else {
      field += character
    }
  }

  if (quoted) throw new Error("CSV_UNTERMINATED_QUOTE")
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function parseConsent(value: string): boolean | null {
  if (!value.trim()) return null
  const normalized = normalizeHeader(value)
  if (["si", "sí", "yes", "true", "1", "acepto"].includes(normalized)) return true
  if (["no", "false", "0"].includes(normalized)) return false
  return null
}

export function previewGuestCsv(
  csv: string,
  options: {
    defaultCallingCode?: string
    existingPhones?: Iterable<string>
  } = {},
): GuestImportPreview {
  const parsed = parseCsv(csv)
  if (parsed.length === 0) {
    return { rows: [], validRows: 0, invalidRows: 0, duplicateRows: 0, groups: 0 }
  }

  const mappedHeaders = parsed[0].map((header) => {
    const normalized = normalizeHeader(header)
    return HEADER_ALIASES[normalized] ?? null
  })
  const unknownHeaders = parsed[0].filter((_, index) => mappedHeaders[index] === null)
  const existingPhones = new Set(options.existingPhones ?? [])
  const seenPhones = new Map<string, string>()
  const groupValues = new Map<string, { phone: string; consent: boolean }>()

  const rows: GuestImportPreviewRow[] = parsed.slice(1).map((cells, rowIndex) => {
    const raw: Record<string, string> = {}
    parsed[0].forEach((header, index) => {
      raw[header] = cells[index] ?? ""
    })

    const values: Partial<Record<NonNullable<(typeof mappedHeaders)[number]>, string>> = {}
    mappedHeaders.forEach((header, index) => {
      if (header) values[header] = cells[index]?.trim() ?? ""
    })

    const issues: GuestImportIssue[] = unknownHeaders.map((header) => ({
      code: "unknown_header",
      field: header,
      message: `La columna “${header}” no se importará.`,
    }))

    const name = values.name?.trim() ?? ""
    const phone = values.phone?.trim() ?? ""
    if (!name) issues.push({ code: "missing_name", field: "name", message: "Falta el nombre." })
    if (!phone) issues.push({ code: "missing_phone", field: "phone", message: "Falta el teléfono." })

    const phoneResult = normalizePhone(phone, options.defaultCallingCode)
    if (phone && !phoneResult.ok) {
      issues.push({ code: "invalid_phone", field: "phone", message: "El teléfono no es válido." })
    }

    const rawConsent = values.consent ?? ""
    const consent = parseConsent(rawConsent)
    if (consent === null) {
      issues.push({
        code: "invalid_consent",
        field: "consent",
        message: "Indicá explícitamente sí o no en consentimiento.",
      })
    }

    const groupKey = values.groupKey?.trim() || undefined
    if (phoneResult.ok) {
      const existingGroupKey = seenPhones.get(phoneResult.phoneE164)
      if (existingPhones.has(phoneResult.phoneE164) || (existingGroupKey && existingGroupKey !== groupKey)) {
        issues.push({
          code: "duplicate_phone",
          field: "phone",
          message: existingPhones.has(phoneResult.phoneE164)
            ? "El teléfono ya existe en el evento."
            : "El teléfono se repite en grupos distintos.",
        })
      } else {
        seenPhones.set(phoneResult.phoneE164, groupKey ?? `row-${rowIndex + 2}`)
      }

      if (groupKey) {
        const groupValue = groupValues.get(groupKey)
        if (groupValue && groupValue.phone !== phoneResult.phoneE164) {
          issues.push({
            code: "duplicate_group_key",
            field: "group_key",
            message: "Todas las personas del mismo grupo deben usar el mismo teléfono.",
          })
        } else if (groupValue && consent !== null && groupValue.consent !== consent) {
          issues.push({
            code: "inconsistent_consent",
            field: "consent",
            message: "Todas las personas del mismo grupo deben tener el mismo consentimiento.",
          })
        } else if (consent !== null) {
          groupValues.set(groupKey, { phone: phoneResult.phoneE164, consent })
        }
      }
    }

    const hasBlockingIssue = issues.some((issue) => issue.code !== "unknown_header")
    return {
      rowNumber: rowIndex + 2,
      raw,
      input:
        !hasBlockingIssue && phoneResult.ok && consent !== null
          ? {
              name,
              phone: phoneResult.phoneE164,
              labels: (values.labels ?? "")
                .split(/[;|]/)
                .map((label) => label.trim())
                .filter(Boolean),
              groupKey,
              consent,
            }
          : null,
      issues,
    }
  })

  return {
    rows,
    validRows: rows.filter((row) => row.input !== null).length,
    invalidRows: rows.filter((row) => row.input === null).length,
    duplicateRows: rows.filter((row) =>
      row.issues.some((issue) => issue.code === "duplicate_phone" || issue.code === "duplicate_group_key"),
    ).length,
    groups: new Set(
      rows.flatMap((row) =>
        row.input ? [row.input.groupKey ?? `row-${row.rowNumber}`] : [],
      ),
    ).size,
  }
}
