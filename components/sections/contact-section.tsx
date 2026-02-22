"use client"

import { Mail, MapPin } from 'lucide-react'
import { useReveal } from "@/hooks/use-reveal"
import { MagneticButton } from "@/components/magnetic-button"

export function ContactSection() {
  const { ref, isVisible } = useReveal(0.3)

  return (
    <section
      ref={ref}
      data-section
      className="flex min-h-screen items-center px-4 py-20 md:px-12 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col items-center justify-center text-center">
          <div
            className={`mb-8 transition-all duration-700 md:mb-12 ${
              isVisible ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
            }`}
          >
            <h2 className="mb-4 font-sans text-4xl font-light leading-[1.1] tracking-tight text-foreground md:mb-6 md:text-6xl lg:text-7xl">
              <span className="text-balance">
                ¿Querés una web que
                <br />
                realmente hable de vos
                <br />
                y de tu evento?
              </span>
            </h2>
          </div>

          <div
            className={`transition-all duration-700 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            <MagneticButton
              variant="primary"
              size="lg"
              className="px-12 py-5 text-lg"
              onClick={() => window.open("https://wa.me/59898630797", "_blank")}
            >
              Hablar por WhatsApp
            </MagneticButton>
          </div>

          <div
            className={`mt-12 flex flex-wrap items-center justify-center gap-6 transition-all duration-700 md:mt-16 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
            style={{ transitionDelay: "400ms" }}
          >
            {/* <div className="text-center">
              <p className="mb-1 font-mono text-xs text-foreground/60">Email</p>
              <a
                href="mailto:hola@eventos.com"
                className="text-sm text-foreground/90 transition-colors hover:text-foreground"
              >
                hola@eventos.com
              </a>
            </div> */}

            <div className="text-center">
              <p className="mb-1 font-mono text-xs text-foreground/60">Instagram</p>
              <a
                href="https://instagram.com/invitia.uy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground/90 transition-colors hover:text-foreground"
              >
                @invitia.uy
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
