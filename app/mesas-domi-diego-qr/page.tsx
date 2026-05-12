import type { Metadata } from "next"
import { mesasDomiDiegoQrSvg } from "@/lib/mesasDomiDiegoQr"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "QR — Tu mesa (Domi & Diego)",
  description: "Escaneá para abrir la búsqueda de mesa.",
  robots: { index: false, follow: false },
}

export default async function MesasDomiDiegoQrFlatPage() {
  const { target, svg } = await mesasDomiDiegoQrSvg()

  return (
    <div className="min-h-screen bg-[#667b5f] text-[#fcf5ed] hanken-grotesk-regular flex flex-col items-center justify-center px-6 py-12">
      <p className="instrument-serif-regular text-center text-3xl md:text-4xl">
        Domi & Diego
      </p>
      <p className="mt-3 text-center text-sm font-medium uppercase tracking-[0.2em] text-[#fcf5ed]/85">
        Consultá tu mesa
      </p>
      <div
        className="mt-10 rounded-2xl bg-[#fcf5ed] p-6 shadow-lg [&_svg]:mx-auto [&_svg]:block"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="mt-8 max-w-lg text-center text-sm text-[#fcf5ed]/90 break-all">
        {target}
      </p>
    </div>
  )
}
