"use client"

import { use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePublicTableLookup } from "@/hooks/use-public-table-lookup"

const bodoni = { fontFamily: "var(--font-bodoni, serif)" } as const

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>

export default function MesasCalasPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const token = use(searchParams).token
  const lookup = usePublicTableLookup("/api/mesas/mxv", token)

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f3ef] text-[#1a1816]">
      <main className="relative z-10 h-[100vh] flex flex-col space-between">

        <section className="px-6 py-16 text-center md:py-20 h-full">
          <div className="mx-auto max-w-lg text-left">
            <h2
              className="mb-8 text-center text-[clamp(2rem,6vw,3rem)] leading-none"
              style={bodoni}
            >
              Tu mesa
            </h2>

            <p className="text-center text-sm text-[#4a4540]">
              La mesa se consulta de forma privada desde el enlace personal de
              tu invitación.
            </p>

            <div className="mt-8 min-h-[4rem]">
              {lookup.status === "loading" && (
                <p className="text-sm text-[#4a4540]">Consultando…</p>
              )}

              {lookup.status === "missing" && (
                <p className="text-sm text-red-700">
                  Abrí el enlace personalizado que recibiste con tu invitación.
                  Si llegaste desde un QR general, pediles a los novios que te
                  lo reenvíen.
                </p>
              )}

              {lookup.status === "invalid" && (
                <p className="text-sm text-red-700">
                  Este enlace no es válido. Pediles a los novios que te reenvíen
                  tu invitación.
                </p>
              )}

              {lookup.status === "error" && (
                <div className="space-y-3">
                  <p className="text-sm text-red-700">{lookup.message}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="border-[#1a1816]/40 bg-transparent text-[#1a1816]"
                  >
                    Reintentar
                  </Button>
                </div>
              )}

              {lookup.status === "ready" &&
                lookup.assignments.length === 0 && (
                  <p className="text-sm text-[#4a4540]">
                    Todavía no hay una mesa para mostrar. Acá solo aparecen los
                    integrantes que confirmaron asistencia.
                  </p>
                )}

              {lookup.status === "ready" &&
                lookup.assignments.length > 0 && (
                <ul className="space-y-3">
                  {lookup.assignments.map((row, index) => (
                    <li
                      key={`${row.name}-${index}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 border border-[#c8c0b4] px-4 py-4"
                    >
                      <span className="font-medium text-[#1a1816]">
                        {row.name}
                      </span>
                      <span
                        className="text-[clamp(1.25rem,4vw,1.75rem)] tracking-[0.05em] text-[#1a1816]"
                        style={bodoni}
                      >
                        Mesa{" "}
                        {row.table ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <footer className="px-6 py-10 md:py-12 mt-auto">
          <div className="text-center">
            <div
              className="mb-4 text-[clamp(1.5rem,5vw,2.5rem)] uppercase"
              style={bodoni}
            >
              Juli y Mati
            </div>
            <p className="text-[0.75rem] uppercase tracking-[0.3em] text-[#4a4540]">
              28 · 03 · 2026
              <br />
              Montevideo, Uruguay
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-6xl text-center">
            <p className="text-xs text-[#4a4540]">
              Hecho especialmente para Juli y Mati por Invitia.uy
            </p>
            <Button
              variant="link"
              asChild
              className="h-auto p-0 text-xs underline underline-offset-2"
            >
              <Link href="/">Conocé más aquí</Link>
            </Button>
          </div>
        </footer>
      </main>
    </div>
  )
}
