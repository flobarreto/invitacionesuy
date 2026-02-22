"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function FAQSection() {
  return (
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
  )
}
