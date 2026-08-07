import type { Metadata } from "next"
import { mesasDomiDiegoQrSvg } from "@/lib/mesasDomiDiegoQr"
import { opaqueInvitationTokenSchema } from "@/lib/seating/public-table-contract"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "QR — Tu mesa (Domi & Diego)",
  description: "QR personalizado para consultar la mesa.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
}

export default async function MesasDomiDiegoQrFlatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const token = opaqueInvitationTokenSchema.safeParse(
    (await searchParams).token,
  )
  const qr = token.success ? await mesasDomiDiegoQrSvg(token.data) : null

  return (
    <div className="min-h-screen bg-[#667b5f] text-[#fcf5ed] hanken-grotesk-regular flex flex-col items-center justify-center px-6 py-12">
      <p className="instrument-serif-regular text-center text-3xl md:text-4xl">
        Domi & Diego
      </p>
      <p className="mt-3 text-center text-sm font-medium uppercase tracking-[0.2em] text-[#fcf5ed]/85">
        Consultá tu mesa
      </p>
      {qr ? (
        <>
          <div
            className="mt-10 rounded-2xl bg-[#fcf5ed] p-6 shadow-lg [&_svg]:mx-auto [&_svg]:block"
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
          <p className="mt-8 max-w-lg text-center text-sm text-[#fcf5ed]/90">
            QR personalizado. Solo permite ver las mesas de este grupo.
          </p>
        </>
      ) : (
        <p className="mt-10 max-w-lg text-center text-sm text-amber-100/95">
          Falta el token del enlace personalizado. Generá este QR desde la
          invitación del grupo; un QR general no puede mostrar mesas de forma
          privada.
        </p>
      )}
    </div>
  )
}
