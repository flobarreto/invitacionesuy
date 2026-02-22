"use client"

import { useReveal } from "@/hooks/use-reveal"
import { MagneticButton } from "@/components/magnetic-button"

export function ServicesSection() {
  const { ref, isVisible } = useReveal(0.3)

  return (
    <section
      ref={ref}
      data-section
      className="flex min-h-screen items-center px-6 py-20 md:px-12 lg:px-16 font-umeko bg-[#cfe3f0] text-[#4d3022]"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div
          className={`mb-12 transition-all duration-700 md:mb-16 ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
            }`}
        >
          <h2 className="mb-2 text-5xl tracking-tight  md:text-6xl lg:text-7xl">
            Planes
          </h2>
          <p className=" text-sm  md:text-lg font-montserrat">La plataforma es la misma.
          La diferencia está en el nivel de diseño.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 md:gap-x-16 md:gap-y-12 lg:gap-x-24">
          {[
            {
              title: "Invitación",
              price: "USD 100",
              description: "Usamos la identidad visual que ya tenés",
              features: [
                "Invitación web personalizada",
                "Sistema de gestión de invitados",
                "Confirmaciones en tiempo real",
                "Panel para mesas y etiquetas",
                "Exportación de datos",
              ],
              cta: "Quiero este plan",
              direction: "right",
            },
            {
              title: "Invitación + Identidad Estratégica",
              price: "USD 200",
              description: "Incluye diseño con acompañamiento profesional",
              features: [
                "Invitación web personalizada",
                "Sistema de gestión de invitados",
                "Confirmaciones en tiempo real",
                "Panel para mesas y etiquetas",
                "Exportación de datos",
                "Sumamos a un diseñador para crear la identidad visual del evento",
              ],
              cta: "Quiero este plan",
              direction: "top",
            },
          ].map((service, i) => (
            <ServiceCard key={i} service={service} index={i} isVisible={isVisible} />
          ))}
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
    cta?: string
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
      className={`group rounded-2xl flex flex-col border border-[#cc5b57] bg-[#fefce7] p-8 backdrop-blur-xl transition-all duration-700 hover:border-foreground/20 hover:bg-foreground/10 ${getRevealClass()}`}
      style={{
        transitionDelay: `${index * 150}ms`,
      }}
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className=" text-2xl font-light  md:text-3xl">{service.title}</h3>
      </div>
      <p className="mb-6 text-sm leading-relaxed  md:text-base">{service.description}</p>
      <div className="space-y-3 font-montserrat">
        <p className=" text-xs ">Incluye:</p>
        {service.features.map((feature, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <p className="text-sm leading-relaxed ">{feature}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-4 mt-auto">
        <div className="flex mt-4">
          <span className=" text-3xl  font-bold">{service.price}</span>
        </div>
        {service.cta && (
          <MagneticButton
            size="lg"
            variant="primary"
            onClick={() => window.open("https://wa.me/59898630797", "_blank")}
            className="w-full !bg-[#cc5b57] !text-white"
          >
            {service.cta}
          </MagneticButton>
        )}
      </div>
    </div>
  )
}
