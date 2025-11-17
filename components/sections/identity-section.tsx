"use client"

import { useReveal } from "@/hooks/use-reveal"

export function IdentitySection() {
  const { ref, isVisible } = useReveal(0.3)

  return (
    <section
      ref={ref}
      data-section
      className="flex min-h-screen items-center px-6 py-20 md:px-12 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-8 md:grid-cols-2 md:gap-16 lg:gap-24">
          <div
            className={`transition-all duration-700 ${
              isVisible ? "translate-x-0 opacity-100" : "-translate-x-16 opacity-0"
            }`}
          >
            <h2 className="mb-4 font-sans text-4xl font-light leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-6xl">
              ¿Querés que todo tu evento tenga una estética coherente?
            </h2>
          </div>

          <div
            className={`space-y-6 transition-all duration-700 ${
              isVisible ? "translate-x-0 opacity-100" : "translate-x-16 opacity-0"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            <p className="text-sm leading-relaxed text-foreground/90 md:text-lg">
              Puedo crear la identidad visual completa:
            </p>
            <div className="space-y-3">
              {[
                "Paleta personalizada",
                "Moodboard",
                "Logo / monograma",
                "Gráfica para invitaciones",
                "Estilo para redes y proveedores",
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 transition-all duration-700 ${
                    isVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
                  }`}
                  style={{ transitionDelay: `${300 + i * 100}ms` }}
                >
                  <div className="mt-1.5 h-px w-8 bg-foreground/30 transition-all duration-300" />
                  <p className="text-sm leading-relaxed text-foreground/90 md:text-base">{item}</p>
                </div>
              ))}
            </div>
            <p className="pt-4 text-sm leading-relaxed text-foreground/80 md:text-lg">
              Una estética que te represente y transforme tu evento en una experiencia.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
