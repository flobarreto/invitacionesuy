"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type MesaRow = {
  id: string
  name: string
  table_number: string | null
}

const MIN_LEN = 4

const bodoni = { fontFamily: "var(--font-bodoni, serif)" } as const

export default function MesasCalasPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MesaRow[]>([])
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = query.trim()
  const canSearch = trimmed.length >= MIN_LEN

  const runSearch = useCallback(async (q: string) => {
    const t = q.trim()
    if (t.length < MIN_LEN) {
      setResults([])
      setReady(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/mesas/mxv?q=${encodeURIComponent(t)}`,
      )
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "No pudimos completar la búsqueda.",
        )
      }

      setResults(Array.isArray(data?.results) ? data.results : [])
      setReady(Boolean(data?.ready))
    } catch (e) {
      setResults([])
      setReady(true)
      setError(e instanceof Error ? e.message : "Ocurrió un error.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!canSearch) {
      setResults([])
      setReady(false)
      setError(null)
      return
    }

    const id = window.setTimeout(() => {
      void runSearch(trimmed)
    }, 320)

    return () => window.clearTimeout(id)
  }, [canSearch, trimmed, runSearch])

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

            <div className="flex flex-col gap-2">
              <label
                htmlFor="mesa-search-calas"
                className="text-[0.7rem] font-bold uppercase text-[#4a4540]"
              >
                Nombre y apellido
              </label>
              <input
                id="mesa-search-calas"
                type="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Escribí al menos 4 letras…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full border-b border-[#1a1816]/40 bg-transparent px-0 py-3 text-[#1a1816] placeholder:text-[#4a4540]/50 focus:border-[#1a1816] focus:outline-none"
              />
            </div>

            <div className="mt-8 min-h-[4rem]">
              {canSearch && loading && (
                <p className="text-sm text-[#4a4540]">Buscando…</p>
              )}

              {canSearch && !loading && error && (
                <p className="text-sm text-red-700">{error}</p>
              )}

              {canSearch && !loading && !error && ready && results.length === 0 && (
                <p className="text-sm text-[#4a4540]">
                  No encontramos coincidencias. Revisá la ortografía o probá con
                  otro fragmento del nombre.
                </p>
              )}

              {canSearch && !loading && !error && results.length > 0 && (
                <ul className="space-y-3">
                  {results.map((row) => (
                    <li
                      key={row.id}
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
                        {row.table_number?.trim()
                          ? row.table_number.trim()
                          : "—"}
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
