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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
      {/* <CustomCursor />
      <GrainOverlay /> */}

      {/* <div
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
      </div> */}

      <div
        className={`relative z-10 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"
          }`}
      >
        {/* HERO */}
        <section
          data-section
          className="flex min-h-screen flex-col justify-center px-6 pb-16 pt-12 md:px-12 md:pb-24 font-umeko"
          style={{
            backgroundImage: "url('/landing/background.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="bg-[#fefce7] w-full h-full text-[#4d3022]">

            <div className="p-6">

              <h1 className="mb-6 animate-in fade-in slide-in-from-bottom-8 font-sans text-6xl font-light leading-[1.1] tracking-tight duration-1000 md:text-7xl lg:text-8xl">
                <span className=" font-umeko">
                  Una invitación
                  <br />
                  tan única como tu evento
                </span>
              </h1>

              <p className="mb-8 animate-in fade-in slide-in-from-bottom-4 text-lg leading-relaxed  duration-1000 delay-200 md:text-xl">
                <span className="text-pretty ">
                  Invitaciones web personalizadas que combinan estética y tecnología.

                  <br />
                  <span className="">
                    Control total de confirmaciones, mesas y organización en un solo lugar.
                  </span>
                </span>
              </p>

              {/* <div className="flex animate-in fade-in slide-in-from-bottom-4 flex-col gap-4 duration-1000 delay-300 sm:flex-row sm:items-center">
              <MagneticButton
                size="lg"
                variant="primary"
                onClick={() => window.open("https://wa.me/59898630797", "_blank")}
                >
                Hablemos por WhatsApp
              </MagneticButton>
              <MagneticButton size="lg" variant="secondary" onClick={() => scrollToSection(2)}>
                Cómo trabajamos
              </MagneticButton>
            </div> */}
            </div>
          </div>
        </section>

        {/* NUEVA SECCIÓN: Gestión de invitados + mesas (con capturas) */}
        <section data-section className="px-6 py-20 md:px-12 md:py-28 bg-[#fefce7] font-umeko">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-2 text-[#4d3022]">
              <div>
                <span className="font-montserrat ">

                  La forma más inteligente de gestionar invitados.
                </span>


                <h2 className="mb-4 text-3xl font-light leading-tight tracking-tight text-[#cc5b57] md:text-4xl">
                  Todo bajo control,
                  <br />
                  sin planillas ni mensajes
                </h2>

                <p className="mb-7 max-w-lg text-base leading-relaxed md:text-lg">
                  Además de una invitación única, accedés a una plataforma privada para administrar confirmaciones, invitados y mesas en tiempo real.
                </p>

                <ul className="mb-8 space-y-3 font-montserrat">
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    Confirmaciones en tiempo real
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    Base de datos de invitados editable
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    Segmentación por etiquetas personalizables (familia, amigos, grupos)
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    Gestión visual de mesas
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                    Exportación en CSV/Excel cuando lo necesites
                  </li>
                </ul>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <MagneticButton
                    size="lg"
                    variant="primary"
                    onClick={() => window.open("https://wa.me/59898630797", "_blank")}
                    className="!bg-[#b3d3f6] !text-[#4d3022] hover:!bg-[#b84a46]"
                  >
                    Quiero ver cómo funciona
                  </MagneticButton>
                  {/* <MagneticButton size="lg" variant="secondary" onClick={() => router.push("/bodaSofi&Gonchi")}>
                    Ver una invitación
                  </MagneticButton> */}
                </div>
              </div>

              {/* Screenshots */}
              <div className="grid gap-4">
                {/* Screenshot principal */}
                <div className="overflow-hidden rounded-2xl border border-[#cc5b57] bg-foreground/5 backdrop-blur">
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
                  <div className="overflow-hidden rounded-2xl border border-[#cc5b57] bg-foreground/5 backdrop-blur">
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

                  <div className="overflow-hidden rounded-2xl border border-[#cc5b57] bg-foreground/5 backdrop-blur">
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


        <ProcessSection />
        <ServicesSection />

        {/* Portfolio Section */}
        <section data-section className="px-6 py-20 md:px-12 md:py-28  text-[#fefce7]"
          style={{
            backgroundImage: "url('/landing/examples.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="mb-2 text-5xl font-light tracking-tight md:text-6xl lg:text-7xl mt-20 md:mt-10 font-umeko text-[#cfe3f0]">
                Invitaciones creadas
              </h2>
            </div>

            <div className="flex justify-center">
              <div className="flex flex-col p-6 rounded-2xl border border-[#f9d4da] backdrop-blur-xl transition-all duration-300 hover:border-foreground/20 hover:bg-foreground/10">
                <div className="md:max-h-[400px] md:w-[400px] flex flex-col">
                  <img src="/landing/bodaSofi.jpg" alt="Boda Sofi & Gonchi" className="h-full object-cover rounded-2xl" />
                </div>
                <h3 className="mb-2 text-2xl font-montserrat text-center mt-4">Boda Sofi & Gonchi</h3>
                <MagneticButton
                  size="default"
                  variant="secondary"
                  onClick={() => router.push("/bodaSofi&Gonchi")}
                  className="!bg-[#f9d4da] !text-[#4d3022] hover:!bg-[#b3d3f6]"
                >
                  Ver invitación
                </MagneticButton>

              </div>
            </div>
          </div>
        </section>
        <div className="flex w-full h-[20px] bg-[#fefce7]" />
        {/* aca crea una seccion de FAQ */}
        <section data-section className="px-6 py-20 md:px-12 md:py-28 bg-[#f9d4da] font-umeko">

          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="mb-2 text-5xl font-light tracking-tight md:text-6xl lg:text-7xl font-umeko text-[#4d3022]">
                Preguntas frecuentes
              </h2>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-2">
              <AccordionItem value="item-1" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Es una app?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  No. Es una web personalizada para tu evento.
                  <br />
                  Funciona desde cualquier celular, tablet o computadora, sin necesidad de descargar nada.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Funciona bien en el celular?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Sí. Está pensada principalmente para mobile, porque la mayoría de los invitados entra desde el teléfono.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Es una plantilla que eligen y editan?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  No trabajamos con plantillas.
                  <br />
                  Cada invitación se diseña desde cero, según la estética y el estilo de tu evento.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Qué incluye exactamente la invitación?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Incluye:
                  <ul className="mt-3 space-y-2 list-disc list-inside">
                    <li>Diseño 100% personalizado</li>
                    <li>RSVP online</li>
                    <li>Información del evento (mapas, horarios, dress code, etc.)</li>
                    <li>Panel privado para gestionar invitados</li>
                    <li>Organización de mesas</li>
                    <li>Descarga en Excel</li>
                  </ul>
                  <br />
                  No es solo una invitación linda. Es una herramienta de organización.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Cómo funciona el RSVP?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Cada invitado confirma desde la misma web.
                  <br />
                  Vos ves todo en tiempo real desde tu panel admin, sin mensajes perdidos ni planillas infinitas.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Puedo agregar o eliminar invitados después?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Sí.
                  <br />
                  Podés editar tu lista cuando quieras desde el panel privado.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Se pueden crear etiquetas (familia, amigos, trabajo, etc.)?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Sí.
                  <br />
                  Podés organizar a tus invitados por categorías y usar eso para mesas o para tener mejor control.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Se puede asignar mesas?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Sí.
                  <br />
                  La gestión de mesas está integrada en el panel. Podés mover invitados fácilmente y tener todo ordenado en un solo lugar.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Se puede actualizar la información si cambia algo?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Sí.
                  <br />
                  Si cambia un horario, dirección o detalle, lo actualizamos y todos ven la versión nueva automáticamente.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-10" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Cuándo conviene hacer la invitación?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Lo ideal es entre 3 y 6 meses antes del evento, así podés empezar a organizar con tiempo y sin estrés.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-11" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Sirve para destination weddings?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Sí.
                  <br />
                  De hecho, es ideal. Podés incluir mapas, recomendaciones, alojamiento y toda la info importante en un solo link.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-12" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Cuánto tiempo lleva el proceso?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Depende del plan, pero generalmente entre 1 y 2 semanas desde que definimos la estética.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-13" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Qué necesito para empezar?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Fecha y lugar del evento</li>
                    <li>Cantidad estimada de invitados</li>
                    <li>Referencias de estética (si ya tenés)</li>
                    <li>Información que querés incluir</li>
                  </ul>
                  <br />
                  Con eso ya podemos empezar a trabajar.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-14" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Por qué no usar una plantilla más barata?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Porque el problema no es solo la invitación.
                  <br />
                  Es la organización.
                  <br />
                  <br />
                  Si querés algo único, que refleje tu evento y además te simplifique la vida, esto está pensado para vos.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-15" className="border-[#4d3022]/20 bg-[#fefce7] rounded-lg px-4">
                <AccordionTrigger className="text-left text-[#4d3022] font-medium hover:no-underline hover:text-[#cc5b57]">
                  ¿Después del evento la web sigue activa?
                </AccordionTrigger>
                <AccordionContent className="text-[#4d3022] leading-relaxed font-montserrat">
                  Sí, durante el período acordado.
                  <br />
                  También podés usarla para compartir un link con las fotos del evento.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
        <section data-section className=" px-6 bg-[#fefce7] font-umeko pt-10 pb-50 flex flex-col items-center justify-center gap-4"
        style={{
          backgroundImage: "url('/landing/ctabg.png')",
          backgroundSize: "cover",
          backgroundPosition: "bottom",
          backgroundRepeat: "no-repeat",
        }}>
          <p className="text-sm font-montserrat text-center">
          ¿Lista para tener una invitación que se vea increíble y además te organice todo?
          </p>
          <p className="text-4xl  text-center">

          Hablemos de tu evento
          </p>

          <MagneticButton
                    size="lg"
                    variant="primary"
                    onClick={() => window.open("https://wa.me/59898630797", "_blank")}
                    className="!bg-[#fefce7] !text-[#cc5b57] hover:!bg-[#b3d3f6]"
                  >
                    Empezar mi invitacion
                  </MagneticButton>

        </section>
      </div>
    </main>
  )
}
