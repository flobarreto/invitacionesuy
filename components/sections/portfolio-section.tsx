"use client"

import { useRouter } from "next/navigation"
import { MagneticButton } from "@/components/magnetic-button"

export function PortfolioSection() {
  const router = useRouter()

  return (
    <section
      data-section
      className="px-6 py-20 md:px-12 md:py-28  text-[#fefce7]"
      style={{
        backgroundImage: "url('/landing/examples.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-2 text-5xl font-light tracking-tight md:text-6xl lg:text-7xl mt-20 md:mt-10 font-umeko text-[#cfe3f0]">
            Invitaciones creadas
          </h2>
        </div>

        <div className="flex justify-center">
          <div className="flex flex-col p-6 rounded-2xl border border-[#f9d4da] backdrop-blur-xl transition-all duration-300 hover:border-foreground/20 hover:bg-foreground/10">
            <div className="md:max-h-[400px] md:w-[400px] flex flex-col">
              <img src="/landing/bodaSofi.webp" alt="Boda Sofi & Gonchi" className="h-full object-cover rounded-2xl" />
            </div>
            <h3 className="mb-2 text-2xl font-montserrat text-center mt-4">Boda Sofi & Gonchi</h3>
            <MagneticButton
              size="default"
              variant="secondary"
              onClick={() => router.push("/bodaSofi&Gonchi")}
              className="!bg-[#f9d4da] !text-[#4d3022] hover:!bg-[#b3d3f6]"
            >
              Ver invitación
            </MagneticButton>
          </div>
        </div>
      </div>
    </section>
  )
}
