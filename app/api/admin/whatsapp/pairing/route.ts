import { assertMutationRequest, requirePlatformAdmin } from "@/lib/auth"
import { crmErrorResponse } from "@/lib/crm/errors"
import { decryptSecret } from "@/lib/whatsapp/crypto"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    await requirePlatformAdmin()
    if (!supabaseAdmin) {
      return Response.json({ error: "Servicio no configurado" }, { status: 503 })
    }
    const { data, error } = await supabaseAdmin
      .from("whatsapp_auth_state")
      .select("encrypted_value,updated_at")
      .eq("storage_key", "pairing_qr")
      .maybeSingle()
    if (error) throw error
    if (!data) return Response.json({ qr: null, connectedOrWaiting: true })
    const secret = process.env.INVITIA_ENCRYPTION_KEY
    if (!secret || Buffer.byteLength(secret.trim(), "utf8") < 32) {
      return Response.json({ error: "Servicio no configurado" }, { status: 503 })
    }
    return Response.json(
      { qr: decryptSecret(data.encrypted_value, secret), updatedAt: data.updated_at },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    return crmErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    assertMutationRequest(request)
    await requirePlatformAdmin()
    if (!supabaseAdmin) {
      return Response.json({ error: "Servicio no configurado" }, { status: 503 })
    }
    // Clearing only an expired QR is safe. Credentials/Signal keys are never
    // deleted by an HTTP endpoint because that would unlink the shared number.
    const { error } = await supabaseAdmin
      .from("whatsapp_auth_state")
      .delete()
      .eq("storage_key", "pairing_qr")
    if (error) throw error
    return Response.json({ ok: true })
  } catch (error) {
    return crmErrorResponse(error)
  }
}
