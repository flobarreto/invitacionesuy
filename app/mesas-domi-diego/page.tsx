"use client"

import { use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePublicTableLookup } from "@/hooks/use-public-table-lookup"

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>

export default function MesasDomiDiegoPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const token = use(searchParams).token
  const lookup = usePublicTableLookup(
    "/api/mesas/boda-domi-diego",
    token,
  )

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#667b5f] hanken-grotesk-regular text-[#fcf5ed]">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col px-5 py-12 md:py-16">
        <div className="mb-10 text-center">
          <p className="instrument-serif-regular text-4xl md:text-6xl leading-tight">
            Domi & Diego
          </p>
          <h1 className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-[#fcf5ed]/85">
            Consultá tu mesa
          </h1>
        </div>

        <div>
          <p className="text-center text-sm text-[#fcf5ed]/85">
            La mesa se consulta de forma privada desde el enlace personal de tu
            invitación.
          </p>

          <div className="mt-6 min-h-[4rem]">
            {lookup.status === "loading" && (
              <p className="text-sm text-[#fcf5ed]/80">Consultando…</p>
            )}

            {lookup.status === "missing" && (
              <p className="text-sm text-amber-100/95">
                Abrí el enlace personalizado que recibiste con tu invitación.
                Si llegaste desde un QR general, pediles a los novios que te lo
                reenvíen.
              </p>
            )}

            {lookup.status === "invalid" && (
              <p className="text-sm text-amber-100/95">
                Este enlace no es válido. Pediles a los novios que te reenvíen
                tu invitación.
              </p>
            )}

            {lookup.status === "error" && (
              <div className="space-y-3">
                <p className="text-sm text-amber-100/95">{lookup.message}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="border-[#fcf5ed]/40 bg-transparent text-[#fcf5ed] hover:bg-[#fcf5ed]/10 hover:text-[#fcf5ed]"
                >
                  Reintentar
                </Button>
              </div>
            )}

            {lookup.status === "ready" &&
              lookup.assignments.length === 0 && (
                <p className="text-sm text-[#fcf5ed]/85">
                  Todavía no hay una mesa para mostrar. Acá solo aparecen los
                  integrantes que confirmaron asistencia.
                </p>
              )}

            {lookup.status === "ready" && lookup.assignments.length > 0 && (
              <ul className="space-y-3">
                {lookup.assignments.map((row, index) => (
                  <li
                    key={`${row.name}-${index}`}
                    className="flex justify-between items-center flex-wrap gap-0.5 rounded-lg border border-[#fcf5ed]/20 bg-[#667b5f]/40 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <span className="font-medium text-[#fcf5ed]">
                      {row.name}
                    </span>
                    <span className="instrument-serif-regular text-2xl  w-[70px] text-[#fcf5ed]">
                      Mesa &nbsp;
                      <span className="text-[#fcf5ed]">
                        {row.table ?? "—"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="text-center text-sm text-[#fcf5ed]/80 mt-auto">
          <div className="max-w-6xl mx-auto text-[#3c4439]">
            <div className="text-center mt-2">
              <p className="text-xs">
                Hecho especialmente para Diego y Domi por Invitia.uy
              </p>
              <Button
                variant="link"
                asChild
                className="text-xs underline underline-offset-2 p-0 h-auto text-[#3c4439]"
              >
                <Link href="/">Conocé más aquí</Link>
              </Button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
