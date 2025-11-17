"use client"

import { useReveal } from "@/hooks/use-reveal"
import { MagneticButton } from "@/components/magnetic-button"

export function GuestManagementSection() {
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
              isVisible ? "translate-y-0 opacity-100" : "-translate-y-16 opacity-0"
            }`}
          >
            <h2 className="mb-4 font-sans text-4xl font-light leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Gestión de
              <br />
              invitados
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-foreground/80 md:text-lg">
              Organizar un evento puede ser un caos.
              <br />
              Por eso, tu página incluye una base de datos donde podés:
            </p>
          </div>

          <div
            className={`space-y-6 transition-all duration-700 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            <div className="space-y-4">
              {[
                { title: "Ver quién confirmó", description: "Lista de invitados" },
                { title: "Registrar preferencias", description: "Alimentación, alergias y necesidades" },
                // { title: "Organizar listas", description: "Grupos, mesas y categorías" },
                { title: "Exportar datos", description: "Para compartir con proveedores" },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`rounded-xl border border-foreground/10 bg-foreground/5 p-6 backdrop-blur-xl transition-all duration-700 hover:border-foreground/20 hover:bg-foreground/10 ${
                    isVisible ? "translate-x-0 opacity-100" : "translate-x-16 opacity-0"
                  }`}
                  style={{ transitionDelay: `${300 + i * 100}ms` }}
                >
                  <h3 className="mb-1 font-sans text-lg font-light text-foreground md:text-xl">{item.title}</h3>
                  <p className="font-mono text-xs text-foreground/60 md:text-sm">{item.description}</p>
                </div>
              ))}
            </div>
            <p className="pt-4 text-sm leading-relaxed text-foreground/90 md:text-lg">
              Es tu propio centro de organización.
            </p>
          </div>
        </div>
        <div
          className={`mt-8 flex justify-center transition-all duration-700 md:mt-12 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
          }`}
          style={{ transitionDelay: "600ms" }}
        >
          <MagneticButton
            size="lg"
            variant="primary"
            onClick={() => window.open("https://wa.me/59898630797", "_blank")}
          >
            Consultar por WhatsApp
          </MagneticButton>
        </div>
      </div>
    </section>
  )
}
