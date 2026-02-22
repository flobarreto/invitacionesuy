"use client"

import { useReveal } from "@/hooks/use-reveal"

export function ProcessSection() {
  const { ref, isVisible } = useReveal(0.3)

  return (
    <section
      ref={ref}
      data-section
      className="flex min-h-screen items-center px-6 py-20 md:px-12 lg:px-16 font-umeko text-[#4d3022]"
      style={{
        backgroundImage: "url('/landing/process3.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div
          className={`mb-6 transition-all duration-700 md:mb-8 ${
            isVisible ? "translate-x-0 opacity-100" : "-translate-x-12 opacity-0"
          }`}
        >
          <h2 className="mb-2  text-5xl tracking-tight  md:text-6xl lg:text-7xl">
            Cómo funciona
          </h2>
          <p className=" text-sm  md:text-base font-montserrat"> En 4 pasos</p>
        </div>

        <div className="space-y-6 md:space-y-8">
          {[
            {
              number: "01",
              title: "Definimos tu evento",
              description: "Nos compartís fecha, estilo y lista inicial de invitados.",
              direction: "left",
            },
            {
              number: "02",
              title: "Diseñamos y activamos la plataforma",
              description: "Creamos tu invitación web personalizada y configuramos el sistema de gestión.",
              direction: "right",
            },
            {
              number: "03",
              title: "Compartís el link",
              description: "Tus invitados confirman asistencia desde la web.",
              direction: "left",
            },
            {
              number: "04",
              title: "Gestionás todo en tiempo real",
              description: "Confirmaciones, mesas y base de datos organizadas desde tu panel privado.",
              direction: "right",
            },
          ].map((step, i) => (
            <ProcessCard key={i} step={step} index={i} isVisible={isVisible} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ProcessCard({
  step,
  index,
  isVisible,
}: {
  step: { number: string; title: string; description: string; direction: string }
  index: number
  isVisible: boolean
}) {
  const getRevealClass = () => {
    if (!isVisible) {
      return step.direction === "left" ? "-translate-x-16 opacity-0" : "translate-x-16 opacity-0"
    }
    return "translate-x-0 opacity-100"
  }

  return (
    <div
      className={`group flex items-center justify-between py-3 transition-all duration-700 hover:border-foreground/20 md:py-4 ${getRevealClass()}`}
      style={{
        transitionDelay: `${index * 150}ms`,
      }}
    >
      <div className="flex items-baseline gap-4 md:gap-8">
        <span className=" text-sm transition-colors  md:text-lg">
          {step.number}
        </span>
        <div>
          <h3 className="mb-1  text-2xl  transition-transform duration-300 group-hover:translate-x-2 md:text-3xl lg:text-4xl">
            {step.title}
          </h3>
          <p className="  text-sm  md:text-lg font-montserrat">{step.description}</p>
        </div>
      </div>
    </div>
  )
}
