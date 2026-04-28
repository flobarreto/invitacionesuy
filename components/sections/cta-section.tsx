"use client"

import { MagneticButton } from "@/components/magnetic-button"

export function CTASection() {
  return (
    <section
      data-section
      className=" px-6 bg-[#fefce7] font-umeko pt-10 pb-50 flex flex-col items-center justify-center gap-4"
      style={{
        backgroundImage: "url('/landing/ctabg.webp')",
        backgroundSize: "cover",
        backgroundPosition: "bottom",
        backgroundRepeat: "no-repeat",
      }}
    >
      <p className="text-sm font-montserrat text-center">
        ¿Lista para tener una invitación que se vea increíble y además te organice todo?
      </p>
      <p className="text-4xl  text-center">
        Hablemos de tu evento
      </p>

      <MagneticButton
        size="lg"
        variant="primary"
        onClick={() => window.open("https://wa.me/59898280590", "_blank")}
        className="!bg-[#fefce7] !text-[#cc5b57] hover:!bg-[#b3d3f6]"
      >
        Empezar mi invitacion
      </MagneticButton>
    </section>
  )
}
