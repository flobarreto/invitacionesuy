"use client"

import { useCallback, useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link";
import { Button } from "@/components/ui/button"

type MesaRow = {
  id: string
  name: string
  table_number: string | null
}

const MIN_LEN = 4

export default function MesasDomiDiegoPage() {
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
        `/api/mesas/boda-domi-diego?q=${encodeURIComponent(t)}`,
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

        <div className="">
          <div className="space-y-2">
            <Label
              htmlFor="mesa-search"
              className="text-[#fcf5ed] text-sm font-medium"
            >
              Nombre y apellido
            </Label>
            <Input
              id="mesa-search"
              type="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Escribí al menos 4 letras…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 border-[#fcf5ed]/35 bg-[#fcf5ed]/95 text-[#3c4439] placeholder:text-[#667b5f]/55 focus-visible:border-[#b48d64] focus-visible:ring-[#b48d64]/40"
            />
          </div>

          <div className="mt-6 min-h-[4rem]">

            {canSearch && loading && (
              <p className="text-sm text-[#fcf5ed]/80">Buscando…</p>
            )}

            {canSearch && !loading && error && (
              <p className="text-sm text-amber-100/95">{error}</p>
            )}

            {canSearch && !loading && !error && ready && results.length === 0 && (
              <p className="text-sm text-[#fcf5ed]/85">
                No encontramos coincidencias. Revisá la ortografía o probá con
                otro fragmento del nombre.
              </p>
            )}

            {canSearch && !loading && !error && results.length > 0 && (
              <ul className="space-y-3">
                {results.map((row) => (
                  <li
                    key={row.id}
                    className="flex justify-between items-center flex-wrap gap-0.5 rounded-lg border border-[#fcf5ed]/20 bg-[#667b5f]/40 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <span className="font-medium text-[#fcf5ed]">
                      {row.name}
                    </span>
                    <span className="instrument-serif-regular text-2xl  w-[70px] text-[#fcf5ed]">
                      Mesa &nbsp;
                      <span className="text-[#fcf5ed]">
                        {row.table_number?.trim()
                          ? row.table_number.trim()
                          : "—"}
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
