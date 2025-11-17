"use client"

import { useReveal } from "@/hooks/use-reveal"

export function ProcessSection() {
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
            isVisible ? "translate-x-0 opacity-100" : "-translate-x-12 opacity-0"
          }`}
        >
          <h2 className="mb-2 font-sans text-5xl font-light tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Proceso
          </h2>
          <p className="font-mono text-sm text-foreground/60 md:text-base">/ Paso a paso</p>
        </div>

        <div className="space-y-6 md:space-y-8">
          {[
            {
              number: "01",
              title: "Nos escribís",
              description: "Nos contás sobre tu evento y lo que imaginás.",
              direction: "left",
            },
            {
              number: "02",
              title: "Hablamos",
              description: "Nos conocemos y definimos juntos el estilo, la vibra y los detalles.",
              direction: "right",
            },
            {
              number: "03",
              title: "Diseño + desarrollo",
              description: "Creamos tu página como si fuera para nosotros: cuidando cada detalle, cada color y cada palabra.",
              direction: "left",
            },
            {
              number: "04",
              title: "Entrega",
              description: "Te la entrego lista para compartir y emocionar a tus invitados.",
              direction: "right",
            },
            {
              number: "05",
              title: "Ajustes",
              description: "Si hay algo que querés cambiar, lo hacemos hasta que quede exactamente como lo soñaste.",
              direction: "left",
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
      className={`group flex items-center justify-between border-b border-foreground/10 py-6 transition-all duration-700 hover:border-foreground/20 md:py-8 ${getRevealClass()}`}
      style={{
        transitionDelay: `${index * 150}ms`,
        marginLeft: index % 2 === 0 ? "0" : "auto",
        maxWidth: index % 2 === 0 ? "85%" : "90%",
      }}
    >
      <div className="flex items-baseline gap-4 md:gap-8">
        <span className="font-mono text-sm text-foreground/30 transition-colors group-hover:text-foreground/50 md:text-base">
          {step.number}
        </span>
        <div>
          <h3 className="mb-1 font-sans text-2xl font-light text-foreground transition-transform duration-300 group-hover:translate-x-2 md:text-3xl lg:text-4xl">
            {step.title}
          </h3>
          <p className="max-w-md font-mono text-xs text-foreground/50 md:text-sm">{step.description}</p>
        </div>
      </div>
    </div>
  )
}
