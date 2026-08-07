export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es")
}

export function normalizeTableCode(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleUpperCase("es")
}

export function sortTableCodes(a: string, b: string): number {
  const aNumber = Number(a)
  const bNumber = Number(b)
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber
  }
  if (Number.isFinite(aNumber)) return -1
  if (Number.isFinite(bNumber)) return 1
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
}
