import { handlePublicTableLookup } from "@/lib/seating/public-table-route"

export async function GET(request: Request) {
  return handlePublicTableLookup(request, "domi-diego")
}
