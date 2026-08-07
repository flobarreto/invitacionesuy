import assert from "node:assert/strict"
import test from "node:test"
import { escapeCsvCell, neutralizeCsvFormula, serializeCsv } from "@/lib/csv-export"

test("neutraliza todos los prefijos de fórmula reconocidos por planillas", () => {
  for (const value of ["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "\t=1+1", "\r=1+1"]) {
    assert.equal(neutralizeCsvFormula(value), `'${value}`)
  }
  assert.equal(neutralizeCsvFormula("Ana"), "Ana")
})

test("escapa comas, comillas y saltos de línea después de neutralizar", () => {
  assert.equal(escapeCsvCell('Ana, "Majo"'), '"Ana, ""Majo"""')
  assert.equal(escapeCsvCell("línea 1\nlínea 2"), '"línea 1\nlínea 2"')
  assert.equal(escapeCsvCell("\r=WEBSERVICE(\"https://example.test\")"),
    '"\'\r=WEBSERVICE(""https://example.test"")"')
})

test("serializa filas con BOM y CRLF por defecto", () => {
  assert.equal(
    serializeCsv([
      ["Nombre", "Asistencia"],
      ["=HYPERLINK(\"https://example.test\")", "Sí"],
      ["Ana, María", null],
    ]),
    '\uFEFFNombre,Asistencia\r\n"\'=HYPERLINK(""https://example.test"")",Sí\r\n"Ana, María",',
  )
})

test("permite omitir BOM y elegir LF sin omitir celdas vacías", () => {
  assert.equal(serializeCsv([[undefined, false, 0]], { bom: false, lineEnding: "\n" }), ",false,0")
})
