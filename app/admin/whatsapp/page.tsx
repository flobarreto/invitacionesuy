import { requirePlatformAdmin } from "@/lib/auth"
import { WhatsAppPairing } from "@/components/crm/whatsapp-pairing"

export default async function WhatsAppAdminPage() {
  await requirePlatformAdmin()
  return <WhatsAppPairing />
}

