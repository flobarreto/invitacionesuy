"use client"

import { useReveal } from "@/hooks/use-reveal"

export function AboutSection({ scrollToSection }: { scrollToSection?: (index: number) => void }) {
  const { ref, isVisible } = useReveal(0.3)

  return (
    <section
      ref={ref}
      data-section
      className="flex min-h-screen items-center px-4 py-20 md:px-12 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-8 md:grid-cols-2 md:gap-16 lg:gap-24">
          <div>
            <div
              className={`mb-6 transition-all duration-700 md:mb-12 ${
                isVisible ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
              }`}
            >
              <h2 className="mb-3 font-sans text-3xl font-light leading-[1.1] tracking-tight text-foreground md:mb-4 md:text-6xl lg:text-7xl">
                Sobre el
                <br />
                servicio
              </h2>
            </div>

            <div
              className={`space-y-4 transition-all duration-700 md:space-y-6 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              <p className="max-w-md text-sm leading-relaxed text-foreground/90 md:text-lg">
                Cada evento tiene una esencia propia. Un tono, una energía, una historia que merece ser contada con
                amor y con intención.
              </p>
              <p className="max-w-md text-sm leading-relaxed text-foreground/90 md:text-lg">
                Por eso, diseñamos páginas web que nacen desde cero, pensadas especialmente para vos. No hay dos iguales:
                cada una refleja la estética, emoción y personalidad de quienes celebran.
              </p>
              <p className="max-w-md text-sm leading-relaxed text-foreground/90 md:text-lg">
                Incluye una base de datos para gestionar RSVP, preferencias y todo lo que necesitás para organizar con
                calma y sin estrés.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-6 md:space-y-12">
            {[
              {
                icon: "✨",
                label: "Diseño único",
                sublabel: "Hecho a medida",
                direction: "right",
              },
              {
                icon: "💝",
                label: "Con amor",
                sublabel: "Atención al detalle",
                direction: "left",
              },
              {
                icon: "🎨",
                label: "Identidad visual",
                sublabel: "Estética coherente",
                direction: "right",
              },
            ].map((item, i) => {
              const getRevealClass = () => {
                if (!isVisible) {
                  return item.direction === "left" ? "-translate-x-16 opacity-0" : "translate-x-16 opacity-0"
                }
                return "translate-x-0 opacity-100"
              }

              return (
                <div
                  key={i}
                  className={`flex items-baseline gap-4 border-l border-foreground/30 pl-4 transition-all duration-700 md:gap-8 md:pl-8 ${getRevealClass()}`}
                  style={{
                    transitionDelay: `${300 + i * 150}ms`,
                    marginLeft: i % 2 === 0 ? "0" : "auto",
                    maxWidth: i % 2 === 0 ? "100%" : "85%",
                  }}
                >
                  <div className="text-4xl md:text-5xl">{item.icon}</div>
                  <div>
                    <div className="font-sans text-base font-light text-foreground md:text-xl">{item.label}</div>
                    <div className="font-mono text-xs text-foreground/60">{item.sublabel}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
