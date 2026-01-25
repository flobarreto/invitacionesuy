"use client"

import { Shader, ChromaFlow, Swirl } from "shaders/react"
import { CustomCursor } from "@/components/custom-cursor"
import { GrainOverlay } from "@/components/grain-overlay"
import { ServicesSection } from "@/components/sections/services-section"
import { ProcessSection } from "@/components/sections/process-section"
import { AboutSection } from "@/components/sections/about-section"
import { IdentitySection } from "@/components/sections/identity-section"
import { GuestManagementSection } from "@/components/sections/guest-management-section"
import { ContactSection } from "@/components/sections/contact-section"
import { MagneticButton } from "@/components/magnetic-button"
import { useRef, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const [currentSection, setCurrentSection] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const shaderContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkShaderReady = () => {
      if (shaderContainerRef.current) {
        const canvas = shaderContainerRef.current.querySelector("canvas")
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          setIsLoaded(true)
          return true
        }
      }
      return false
    }

    if (checkShaderReady()) return

    const intervalId = setInterval(() => {
      if (checkShaderReady()) {
        clearInterval(intervalId)
      }
    }, 100)

    const fallbackTimer = setTimeout(() => {
      setIsLoaded(true)
    }, 1500)

    return () => {
      clearInterval(intervalId)
      clearTimeout(fallbackTimer)
    }
  }, [])

  const scrollToSection = (index: number) => {
    const sections = document.querySelectorAll("[data-section]")
    if (sections[index]) {
      sections[index].scrollIntoView({ behavior: "smooth" })
      setCurrentSection(index)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("[data-section]")
      const scrollPosition = window.scrollY + window.innerHeight / 2

      sections.forEach((section, index) => {
        const element = section as HTMLElement
        const top = element.offsetTop
        const bottom = top + element.offsetHeight

        if (scrollPosition >= top && scrollPosition < bottom) {
          setCurrentSection(index)
        }
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <main className="relative min-h-screen w-full bg-background">
      <CustomCursor />
      <GrainOverlay />

      <div
        ref={shaderContainerRef}
        className={`fixed inset-0 z-0 transition-opacity duration-700 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        style={{ contain: "strict" }}
      >
        <Shader className="h-full w-full">
          <Swirl
            colorA="#5FD3BC"
            colorB="#F4A8B8"
            speed={0.8}
            detail={0.8}
            blend={50}
            coarseX={40}
            coarseY={40}
            mediumX={40}
            mediumY={40}
            fineX={40}
            fineY={40}
          />
          <ChromaFlow
            baseColor="#5FD3BC"
            upColor="#5FD3BC"
            downColor="#E8E8E8"
            leftColor="#F4A8B8"
            rightColor="#F4A8B8"
            intensity={0.9}
            radius={1.8}
            momentum={25}
            maskType="alpha"
            opacity={0.97}
          />
        </Shader>
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div
        className={`relative z-10 transition-opacity duration-700 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* HERO */}
        <section
          data-section
          className="flex min-h-screen flex-col justify-end px-6 pb-16 pt-24 md:px-12 md:pb-24"
        >
          <div className="max-w-3xl">
            <div className="mb-4 inline-block animate-in fade-in slide-in-from-bottom-4 rounded-full border border-foreground/20 bg-foreground/15 px-4 py-1.5 backdrop-blur-md duration-700">
              <p className="font-mono text-xs text-foreground/90">
                Invitaciones web únicas · sin plantillas
              </p>
            </div>

            <h1 className="mb-6 animate-in fade-in slide-in-from-bottom-8 font-sans text-6xl font-light leading-[1.1] tracking-tight text-foreground duration-1000 md:text-7xl lg:text-8xl">
              <span className="text-balance">
                Una invitación
                <br />
                tan única como tu evento
              </span>
            </h1>

            <p className="mb-8 max-w-xl animate-in fade-in slide-in-from-bottom-4 text-lg leading-relaxed text-foreground/90 duration-1000 delay-200 md:text-xl">
              <span className="text-pretty">
                Diseñamos invitaciones web completamente personalizadas para que tu historia y tu estética se sientan
                propias.
                <br />
                <span className="text-foreground/95">
                  Sin plantillas. Sin repeticiones. Solo diseño hecho a medida.
                </span>
              </span>
            </p>

            <div className="flex animate-in fade-in slide-in-from-bottom-4 flex-col gap-4 duration-1000 delay-300 sm:flex-row sm:items-center">
              <MagneticButton
                size="lg"
                variant="primary"
                onClick={() => window.open("https://wa.me/59898630797", "_blank")}
              >
                Hablemos por WhatsApp
              </MagneticButton>
              <MagneticButton size="lg" variant="secondary" onClick={() => scrollToSection(1)}>
                Cómo trabajamos
              </MagneticButton>
            </div>
          </div>
        </section>

        <ServicesSection />
        
        <ProcessSection />
                {/* NUEVA SECCIÓN: Gestión de invitados + mesas (con capturas) */}
                <section data-section className="px-6 py-20 md:px-12 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/10 px-4 py-1.5 backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-foreground/70" />
                  <p className="font-mono text-xs text-foreground/90">Panel de administración</p>
                </div>

                <h2 className="mb-4 text-3xl font-light leading-tight tracking-tight text-foreground md:text-4xl">
                  Todo bajo control,
                  <br />
                  sin planillas ni mensajes
                </h2>

                <p className="mb-7 max-w-lg text-base leading-relaxed text-foreground/85 md:text-lg">
                  Además de una invitación irrepetible, tenés una plataforma privada para gestionar invitados y mesas en
                  tiempo real — simple, clara y pensada para novios.
                </p>

                <ul className="mb-8 space-y-3 text-foreground/90">
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    Confirmaciones de asistencia en tiempo real
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    Lista de invitados siempre actualizada (agregar, editar, eliminar)
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    Etiquetas personalizadas (familia, amigos, grupos)
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    Gestión de mesas visual y ordenada
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    Descarga de la lista en CSV/Excel cuando lo necesites
                  </li>
                </ul>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <MagneticButton
                    size="lg"
                    variant="primary"
                    onClick={() => window.open("https://wa.me/59898630797", "_blank")}
                  >
                    Quiero ver cómo funciona
                  </MagneticButton>
                  <MagneticButton size="lg" variant="secondary" onClick={() => router.push("/bodaSofi&Gonchi")}>
                    Ver una invitación
                  </MagneticButton>
                </div>
              </div>

              {/* Screenshots */}
              <div className="grid gap-4">
                {/* Screenshot principal */}
                <div className="overflow-hidden rounded-2xl border border-foreground/15 bg-foreground/5 backdrop-blur">
                  <div className="flex items-center gap-2 border-b border-foreground/10 bg-foreground/5 px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
                      <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
                      <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
                    </div>
                    <p className="ml-2 text-xs text-foreground/70">Admin · Invitados</p>
                  </div>
                  <img
                    src="/screens/admin-guest-list.png"
                    alt="Captura del panel de administración: lista de invitados"
                    className="h-auto w-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* 2 screenshots chicas */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="overflow-hidden rounded-2xl border border-foreground/15 bg-foreground/5 backdrop-blur">
                    <div className="border-b border-foreground/10 bg-foreground/5 px-4 py-3">
                      <p className="text-xs text-foreground/70">Admin · Mesas</p>
                    </div>
                    <img
                      src="/screens/admin-tables.png"
                      alt="Captura del panel de administración: gestión de mesas"
                      className="h-auto w-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-foreground/15 bg-foreground/5 backdrop-blur">
                    <div className="border-b border-foreground/10 bg-foreground/5 px-4 py-3">
                      <p className="text-xs text-foreground/70">Admin · Etiquetas</p>
                    </div>
                    <img
                      src="/screens/admin-tags.png"
                      alt="Captura del panel de administración: etiquetas de invitados"
                      className="h-auto w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <AboutSection scrollToSection={scrollToSection} />
        <IdentitySection />
        <GuestManagementSection />

        <ContactSection />
      </div>
    </main>
  )
}
