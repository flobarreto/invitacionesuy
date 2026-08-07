import assert from "node:assert/strict"
import test from "node:test"
import { CrmError, crmErrorResponse } from "@/lib/crm/errors"

test("CRM no expone detalles internos de errores 5xx", async () => {
  const originalError = console.error
  console.error = () => undefined
  try {
    const response = crmErrorResponse(new CrmError(
      "El servicio no está disponible en este momento.",
      "SERVICE_UNAVAILABLE",
      503,
      { message: "database password and internal relation" },
    ))
    const body = await response.json()

    assert.equal(response.status, 503)
    assert.deepEqual(body, {
      error: "El servicio no está disponible en este momento.",
      code: "SERVICE_UNAVAILABLE",
    })
  } finally {
    console.error = originalError
  }
})

test("CRM conserva detalles únicamente para errores operativos públicos", async () => {
  const response = crmErrorResponse(new CrmError(
    "La vista previa cambió.",
    "PREVIEW_CHANGED",
    409,
    { expectedHash: "safe-public-hash" },
  ))
  assert.deepEqual(await response.json(), {
    error: "La vista previa cambió.",
    code: "PREVIEW_CHANGED",
    details: { expectedHash: "safe-public-hash" },
  })
})
