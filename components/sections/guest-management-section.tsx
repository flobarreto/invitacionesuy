"use client"

import { MagneticButton } from "@/components/magnetic-button"

export function GuestManagementSection() {
  return (
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
                onClick={() => window.open("https://wa.me/59898280590", "_blank")}
                className="!bg-[#b3d3f6] !text-[#4d3022] hover:!bg-[#b84a46]"
              >
                Quiero ver cómo funciona
              </MagneticButton>
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
                src="/screens/admin-guest-list.webp"
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
                  src="/screens/admin-tables.webp"
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
                  src="/screens/admin-tags.webp"
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
  )
}
