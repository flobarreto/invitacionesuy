export type CsvCell = string | number | boolean | null | undefined

const FORMULA_PREFIX = /^[=+\-@\t\r]/

/**
 * Spreadsheet applications can execute cells beginning with formula control
 * characters. Prefixing an apostrophe forces Excel-compatible applications to
 * treat the cell as text while preserving the original content.
 */
export function neutralizeCsvFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value
}

export function escapeCsvCell(value: CsvCell): string {
  const text = neutralizeCsvFormula(value === null || value === undefined ? "" : String(value))
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function serializeCsv(
  rows: ReadonlyArray<ReadonlyArray<CsvCell>>,
  options: { bom?: boolean; lineEnding?: "\n" | "\r\n" } = {},
): string {
  const lineEnding = options.lineEnding ?? "\r\n"
  const content = rows.map((row) => row.map(escapeCsvCell).join(",")).join(lineEnding)
  return `${options.bom === false ? "" : "\uFEFF"}${content}`
}
