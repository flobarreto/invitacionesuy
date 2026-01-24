"use client"

import { useReveal } from "@/hooks/use-reveal"
import { MagneticButton } from "@/components/magnetic-button"

export function ServicesSection() {
  const { ref, isVisible } = useReveal(0.3)

  return (
    <section
      ref={ref}
      data-section
      className="flex min-h-screen items-center px-6 py-20 md:px-12 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div
          className={`mb-12 transition-all duration-700 md:mb-16 ${
            isVisible ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
          }`}
        >
          <h2 className="mb-2 font-sans text-5xl font-light tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Servicios
          </h2>
          <p className="font-mono text-sm text-foreground/60 md:text-base">/ Opciones para tu evento</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 md:gap-x-16 md:gap-y-12 lg:gap-x-24">
          {[
            {
              title: "Identidad Visual + Página Web",
              price: "USD 200",
              description: "La experiencia completa para que tu evento brille con una identidad única y una web que enamore a tus invitados desde el primer clic.",
              features: [
                "Identidad visual exclusiva diseñada especialmente para tu evento",
                "Paleta de colores, tipografías, moodboard y estilo gráfico personalizado",
                "Página web única con diseño y desarrollo profesional",
                "Link personalizado para compartir con tus invitados",
                "Sistema de RSVP integrado con base de datos de invitados",
                "Panel de administración completo: gestión de invitados, etiquetas y asignación de mesas",
              ],
              direction: "top",
            },
            {
              title: "Página Web Personalizada",
              price: "USD 100",
              description: "Perfecto si ya tenés tu estética definida. Una web que refleje tu estilo y simplifique la organización de tu evento.",
              features: [
                "Página web personalizada con diseño y desarrollo profesional",
                "Link personalizado para compartir con tus invitados",
                "Sistema de RSVP integrado con base de datos de invitados",
                "Panel de administración completo: gestión de invitados, etiquetas y asignación de mesas",
              ],
              direction: "right",
            },
          ].map((service, i) => (
            <ServiceCard key={i} service={service} index={i} isVisible={isVisible} />
          ))}
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

function ServiceCard({
  service,
  index,
  isVisible,
}: {
  service: {
    title: string
    price: string
    description: string
    features: string[]
    direction: string
  }
  index: number
  isVisible: boolean
}) {
  const getRevealClass = () => {
    if (!isVisible) {
      switch (service.direction) {
        case "left":
          return "-translate-x-16 opacity-0"
        case "right":
          return "translate-x-16 opacity-0"
        case "top":
          return "-translate-y-16 opacity-0"
        case "bottom":
          return "translate-y-16 opacity-0"
        default:
          return "translate-y-12 opacity-0"
      }
    }
    return "translate-x-0 translate-y-0 opacity-100"
  }

  return (
    <div
      className={`group rounded-2xl border border-foreground/10 bg-foreground/5 p-8 backdrop-blur-xl transition-all duration-700 hover:border-foreground/20 hover:bg-foreground/10 ${getRevealClass()}`}
      style={{
        transitionDelay: `${index * 150}ms`,
      }}
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-sans text-2xl font-light text-foreground md:text-3xl">{service.title}</h3>
        <span className="font-sans text-3xl font-light text-foreground">{service.price}</span>
      </div>
      <p className="mb-6 text-sm leading-relaxed text-foreground/80 md:text-base">{service.description}</p>
      <div className="space-y-3">
        <p className="font-mono text-xs text-foreground/60">Incluye:</p>
        {service.features.map((feature, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <p className="text-sm leading-relaxed text-foreground/90">{feature}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
