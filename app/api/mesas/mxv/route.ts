import { handlePublicTableLookup } from "@/lib/seating/public-table-route"

export async function GET(request: Request) {
  // `mxv` is kept only as a public URL alias. Its historical table was the
  // wrong source for Calas; the event is now resolved from the canonical CRM.
  return handlePublicTableLookup(request, "calas")
}
