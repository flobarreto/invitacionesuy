"use client"

import { useState, useEffect, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import { RadioGroup, RadioGroupItem } from "@radix-ui/react-radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@radix-ui/react-separator";
import { CalendarIcon, SendIcon, MapPinIcon, MessageCircleIcon, MessageCircleHeart } from "lucide-react"
import Image from "next/image"
import Link from "next/link";

const eventSections = [
  {
    id: "ceremony",
    icon: "/bodaSofi&Gonchi/church.png",
    iconHeight: "h-[100px]",
    title: "Ceremonia",
    locationName: "Parroquia San Juan Bautista",
    locationAddress: "Monseñor Domingo Tamburini 1210",
    time: "19:30",
    timeLabel: "Puntual",
    hasButton: true,
    googleURL: 'https://maps.app.goo.gl/2Za2Mna6u83ykAdw9',
    wazeURL: "https://ul.waze.com/ul?venue_id=199099819.1991325869.1381639&overview=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location"
  },
  {
    id: "party",
    icon: "/bodaSofi&Gonchi/party.png",
    iconHeight: "h-[100px]",
    title: "Fiesta",
    locationName: "Quinta de Arteaga",
    locationAddress: "Ruta 5, Km 12.500",
    time: "Post",
    timeLabel: "Ceremonia",
    hasButton: true,
    googleURL: 'https://maps.app.goo.gl/GaQ83n2DW6gqASyR8',
    wazeURL: "https://ul.waze.com/ul?venue_id=199034284.1990539447.12247172&overview=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location"
  },
  {
    id: "gift",
    icon: "/bodaSofi&Gonchi/gift.png",
    iconHeight: "h-[100px]",
    title: "Regalos",
    giftInformation: {
      name: "Sofia Rodriguez",
      bank: "Itau",
      accountNumber: "12345",
      accountType: "Caja de ahorro USD"
    }
  },
];

const attendanceOptions = [
  { value: "si", label: "Sí, allí estaré" },
  { value: "no", label: "No, lo siento" },
];

const dietaryOptions = [
  { value: "no", label: "Sin Restricción" },
  { value: "vegetariano", label: "Vegetariano" },
  { value: "celiaco", label: "Celíaco" },
];

const DEFAULT_ATTENDANCE_RESPONSE = attendanceOptions[0]?.value ?? "si"
const DEFAULT_NAME = ""
const DEFAULT_SONG = ""

export default function BodaSofiGonchi() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })
  const [dietarySelection, setDietarySelection] = useState<string[]>([dietaryOptions[0].value ?? "no"])
  const [guestName, setGuestName] = useState(DEFAULT_NAME)
  const [attendanceResponse, setAttendanceResponse] = useState(DEFAULT_ATTENDANCE_RESPONSE)
  const [favoriteSong, setFavoriteSong] = useState(DEFAULT_SONG)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionFeedback, setSubmissionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const targetDate = new Date('2026-05-30T19:30:00').getTime()

    const updateCountdown = () => {
      const now = new Date().getTime()
      const difference = targetDate - now

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24))
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))

        setTimeLeft({ days, hours, minutes })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 })
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Actualizar cada minuto

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (submissionFeedback?.type === "success") {
      const timeout = setTimeout(() => {
        setSubmissionFeedback(null)
      }, 5000)
      return () => clearTimeout(timeout)
    }
  }, [submissionFeedback])

  const copyToClipboard = (text: string) => {
    if (typeof navigator === "undefined") return

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        console.error("No se pudo copiar el texto al portapapeles.")
      })
      return
    }

    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    try {
      document.execCommand("copy")
    } catch (err) {
      console.error("No se pudo copiar el texto al portapapeles.", err)
    } finally {
      document.body.removeChild(textarea)
    }
  }

  const resetForm = (options?: { preserveFeedback?: boolean }) => {
    setGuestName(DEFAULT_NAME)
    setAttendanceResponse(DEFAULT_ATTENDANCE_RESPONSE)
    setDietarySelection([dietaryOptions[0].value ?? "none"])
    setFavoriteSong(DEFAULT_SONG)
    if (!options?.preserveFeedback) {
      setSubmissionFeedback(null)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmissionFeedback(null)

    if (!guestName.trim()) {
      setSubmissionFeedback({
        type: "error",
        message: "Necesitamos tu nombre para registrar la asistencia.",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/rsvp/bodaSofiGonchi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: guestName.trim(),
          attendance: attendanceResponse,
          dietaryPreferences: dietarySelection,
          favoriteSong: favoriteSong.trim(),
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.error ?? "No pudimos guardar tu respuesta. Intenta nuevamente.")
      }

      setSubmissionFeedback({
        type: "success",
        message: "Enviado",
      })
      resetForm({ preserveFeedback: true })
    } catch (error) {
      setSubmissionFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Ocurrió un error inesperado. Intenta nuevamente.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isSuccessState = submissionFeedback?.type === "success"

  return (
    <main className="source-sans-3-font h-[100vh] w-full min-w-0 max-w-full overflow-x-clip">


      
      <section className="relative h-full bg-[#F9F7EB] p-[20px] flex flex-col justify-between border-b border-[#3c4439]">
      <div className="h-full w-full max-w-[480px] mx-auto px-5 py-5 border border-black box-border">
      <div className="text-[#095F7E] font-light flex flex-col items-end justify-center relative z-10">
          <p className="pt-5 text-xl">ב״ה</p>
          <p className="pt-0 pb-10 italiana-regular text-[#3c4439] text-[50px] text-center">Domi  <span className="font-dancing my-1 mb-3block text-6xl md:my-0 md:mb-0 md:mt-0 md:mx-[-10px] md:text-[100px]">
              &
            </span> Diego</p>
        </div>

        <img src="/bodaDomi&Diego/fondo4.png" alt="Fondo" className="w-full h-[400px] object-cover" />

    
  

        <div className="flex flex-col items-center relative z-10 ">
        <p className="text-[#3c4439] text-[28px] mt-10 italiana-regular"> 30 . MAYO . 2026</p>
          {/* <Button asChild className="h-8 gap-2 mb-[16px] pl-3 pr-4 py-0 bg-[#0c4256] hover:bg-[#0c4256] rounded-[100px] transition-colors">
            <a href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Boda+Sofi+%26+Gonchi&dates=20251220T223000Z/20251221T013000Z&details=%C2%A1Guardate+la+fecha+de+nuestro+casamiento+para+que+no+te+olvides+y+puedas+compartir+con+nosotros%21" target="_blank" rel="noopener noreferrer">
              <CalendarIcon className="w-5 h-5" />
              <span className=" font-light text-[#f9f7eb] text-base text-center tracking-[0] leading-[normal] whitespace-nowrap">
                Agendar
              </span>
            </a>
          </Button> */}
          <div className="shadows-into-light-regular text-center text-[#3c4439] text-[20px] inline-flex flex-col items-center gap-3 relative rounded-[1000px] bg-[rgba(249,247,235,0.75)] py-[12px] px-[32px]">
            Faltan <br></br>
            {timeLeft.days} d . {String(timeLeft.hours).padStart(2, '0')} h . {String(timeLeft.minutes).padStart(2, '0')} m
          </div>
        </div>
        </div>
      </section>

      <section className="bg-[#667b5f] max-w-[100%] min-h-[400px] text-[#F9F7EB] flex flex-wrap lg:gap-12 lg:flex-nowrap lg:flex-row flex-col items-center justify-center pt-6 border-t border-[#3c4439]">
      <section
          id="detalles"
          className=" px-6 pb-5 text-centerx pt-10 text-white"
        >
          <div className="mx-auto max-w-[700px]">
            <h2 className="shadows-into-light-regular mb-6 text-[clamp(2.5rem,7vw,4rem)] leading-none text-center">
              Ceremonia y Fiesta
            </h2>

            <div className="mb-12 grid grid-cols-1 text-center md:grid-cols-2">
              <div className="p-6 md:border-r md:border-[#c8c0b4]">
                <span className="mb-3 block text-[0.95rem] uppercase tracking-[0.35em] text-black md:text-[0.8rem]">
                  Fecha
                </span>
                <div className="italiana-regular text-[clamp(1.6rem,4vw,2.1rem)] leading-[1.3] md:text-[clamp(1.75rem,2.2vw,2.35rem)]">
                  Sábado
                  <br />
                  30 de Mayo
                </div>
                <div className="mt-1 text-[1.15rem] text-black md:text-lg">
                  2026
                </div>
              </div>

              <div className="mx-auto h-px w-[60px] bg-[#3c4439] md:hidden" />

              <div className="p-6">
                <span className="mb-3 block text-[0.95rem] uppercase tracking-[0.35em] text-black md:text-[0.8rem]">
                  Hora
                </span>
                <div className="italiana-regular text-[clamp(1.6rem,4vw,2.1rem)] leading-[1.3] md:text-[clamp(1.75rem,2.2vw,2.35rem)]">
                  20:00 hs
                </div>
                <div className="mt-1 text-[1.15rem] text-black md:text-lg">
                  Hasta las 4:00 am
                </div>
              </div>

              <div className="mx-auto h-px w-[60px] bg-[#3c4439] md:hidden" />

              <div className="p-6 md:col-span-2">
                <span className="mb-3 block text-[0.95rem] uppercase tracking-[0.35em] text-black md:text-[0.8rem]">
                  Lugar
                </span>
                <div className="italiana-regular text-[clamp(1.6rem,4vw,2.1rem)] leading-[1.3] md:text-[clamp(1.75rem,2.2vw,2.35rem)]">
                  Regency Park Hotel, Jacksonville
                </div>
                <a
                  href="https://maps.app.goo.gl/1Jg77CGJmnvijbK7A"
                  // target={openExternalInNewTab === true ? "_blank" : undefined}
                  // rel={
                  //   openExternalInNewTab === true
                  //     ? "noopener noreferrer"
                  //     : undefined
                  // }
                  className="mt-1 block text-[0.85rem] text-black underline underline-offset-2 transition hover:text-[#f5f3ef] hover:underline md:text-lg border-none outline-none"
                >
                  Ruta 8 KM 17, Montevideo, Uruguay
                </a>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="https://ul.waze.com/ul?venue_id=199165356.1991784633.7109267&overview=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location"
                // target={openExternalInNewTab === true ? "_blank" : undefined}
                // rel={
                //   openExternalInNewTab === true
                //     ? "noopener noreferrer"
                //     : undefined
                // }
                className="inline-block shadows-into-light-regular border rounded-full  bg-transparent px-9 py-3.5 text-[1.5rem] uppercase transition hover:bg-[#f5f3ef] hover:text-[#1a1816]"
              >
                Cómo ir?
              </a>

              <a
                href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Boda+Domi+%26+Diego&dates=20260530T230000Z/20260531T070000Z&location=Regency+Park+Hotel%2C+Montevideo"
                // target={openExternalInNewTab === true ? "_blank" : undefined}
                // rel={
                //   openExternalInNewTab === true
                //     ? "noopener noreferrer"
                //     : undefined
                // }
                className="inline-block border rounded-full shadows-into-light-regular bg-transparent px-9 py-3.5 text-[1.5rem] uppercase transition hover:bg-[#f5f3ef] hover:text-[#1a1816]"
              >
                Agendar
              </a>
            </div>
          </div>
        </section>
      </section>
      <section className="w-full justify-around gap-6 px-6 py-10 bg-[linear-gradient(180deg,rgb(134, 154, 133)_0%,rgb(255, 255, 255)_100%)] flex flex-col items-center">
        <Card
          className="flex flex-col items-center gap-6 p-6 w-full max-w-md rounded-3xl border-0 bg-transparent translate-y-[-1rem] animate-fade-in opacity-0"
          style={{
            backgroundImage: "url(/bodaSofi&Gonchi/formBackground.jpeg)",
            backgroundPosition: "50%",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundColor: "rgba(249, 247, 235, 0.75)",
            backgroundBlendMode: "soft-light",
          }}
        >
          <CardContent className="w-full p-0">
            <form onSubmit={handleSubmit} className="flex flex-col items-center gap-8 w-full">
              <h1 className="w-fit shadows-into-light-regular text-[#3c4439] text-[28px] tracking-[0] leading-[normal] whitespace-nowrap">
                Asistencia
              </h1>

              <div className="flex flex-col items-start gap-2 w-full">
                <Label
                  htmlFor="name-input"
                  className="font-semibold text-[#3c4439] text-xs tracking-[0] leading-[normal]"
                >
                  Nombre y Apellido:
                </Label>

                <Input
                  id="name-input"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  className="flex text-[16px] items-center justify-center gap-2 px-3 py-2 w-full rounded border-[0.75px] border-solid border-[#3c4439] bg-transparent  text-[#3c4439] text-base tracking-[0] leading-[normal] h-auto"
                  placeholder="Ej. Gonzalo Puig"
                />
              </div>

              <div className="flex flex-col items-start gap-4 w-full">
                <Label className="font-semibold text-[#3c4439] text-xs tracking-[0] leading-[normal]">
                  ¿Asistes a la boda?
                </Label>

                <RadioGroup
                  value={attendanceResponse}
                  onValueChange={(value) => setAttendanceResponse(value)}
                  className="flex flex-col gap-2 w-full"
                >
                  {attendanceOptions.map((option) => (
                    <div
                      key={option.value}
                      className="inline-flex items-center gap-2"
                    >
                      <RadioGroupItem
                        value={option.value}
                        id={`attendance-${option.value}`}
                        className="w-5 h-5 rounded-full border border-[#3c4439] bg-[#f9f7ebcc] text-[#3c4439] data-[state=checked]:bg-[#3c4439] data-[state=checked]:border-[#3c4439] data-[state=checked]:shadow-[inset_0_0_0_3px_#f9f7ebcc] focus-visible:ring-[#3c4439]/30"
                      />
                      <Label
                        htmlFor={`attendance-${option.value}`}
                        className="font-light text-[#3c4439] text-base tracking-[0] leading-[normal] whitespace-nowrap cursor-pointer"
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex flex-col items-start gap-4 w-full">
                <Label className="font-semibold text-[#3c4439] text-xs tracking-[0] leading-[normal]">
                  Restricciones Alimentarias (Menú Especial)
                </Label>

                <div className="flex flex-col gap-2 w-full">
                  {dietaryOptions.map((option) => {
                    const isChecked = dietarySelection.includes(option.value)
                    return (
                      <div
                        key={option.value}
                        className="inline-flex items-center gap-2"
                      >
                        <Checkbox
                          id={`dietary-${option.value}`}
                          checked={isChecked}
                          onCheckedChange={(state) => {
                            const nextChecked = state === true
                            setDietarySelection((prev) => {
                              if (option.value === "no") {
                                if (nextChecked) {
                                  return ["no"]
                                }
                                return prev.filter((value) => value !== "no")
                              }

                              if (nextChecked) {
                                const withoutNo = prev.filter((value) => value !== "no")
                                if (withoutNo.includes(option.value)) return withoutNo
                                return [...withoutNo, option.value]
                              }

                              return prev.filter((value) => value !== option.value)
                            })
                          }}
                          className="w-5 h-5 rounded-[6px] border border-[#3c4439] bg-[#f9f7ebcc] text-[#3c4439] data-[state=checked]:bg-[#3c4439] data-[state=checked]:border-[#3c4439] focus-visible:ring-[#3c4439]/30"
                        />
                        <Label
                          htmlFor={`dietary-${option.value}`}
                          className="font-light text-[#3c4439] text-base tracking-[0] leading-[normal] whitespace-nowrap cursor-pointer"
                        >
                          {option.label}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 w-full">
                <Label
                  htmlFor="music-input"
                  className="font-semibold text-[#3c4439] text-xs tracking-[0] leading-[normal]"
                >
                  ¿Qué canción no puede faltar?
                </Label>

                <Input
                  id="music-input"
                  value={favoriteSong}
                  onChange={(event) => setFavoriteSong(event.target.value)}
                  placeholder="Comparte tu canción favorita"
                  className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded border-[0.75px] border-solid border-[#3c4439] bg-transparent text-[#3c4439] text-base tracking-[0] leading-[normal] h-auto"
                />
              </div>

              <div className="flex flex-col sm:flex-row w-full gap-3">
                <Button
                  type="submit"
                  disabled={true}
                  className={`flex-1 flex items-center justify-center gap-2 pl-3 pr-4 py-3 rounded-[100px] font-light text-[#f9f7eb] text-xl text-center tracking-[0] leading-[normal] whitespace-nowrap h-[40px] transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    isSuccessState ? "bg-[#3c4439] hover:bg-[#3c4439]" : "bg-[#0c4256] hover:bg-[#0c4256]"
                  }`}
                >
                  {isSuccessState ? (
                    "Enviado, te esperamos!"
                  ) : (
                    <>
                      <SendIcon className="w-5 h-5" />
                      {isSubmitting ? "Enviando..." : "Enviar"}
                    </>
                  )}
                </Button>
              </div>

              {submissionFeedback?.type === "error" && (
                <p
                  className="text-sm text-center text-red-200"
                  role="status"
                  aria-live="polite"
                >
                  {submissionFeedback.message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </section>
      <section className="relative w-full h-[472px] px-6 py-10 flex flex-col items-center bg-gradient-to-t from-[#0C4256] via-[#0C4256]/80 to-[#0C4256]/30 border-t border-[#0C4256]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(81.64% 81.64% at 50% 81.64%, rgba(12, 66, 86, 0) 70%, #0C4256 100%), linear-gradient(180deg, rgba(83, 44, 10, 0) 65.38%, rgba(83, 44, 10, 0.9) 100%), url(/bodaSofi&Gonchi/bottomBackground.jpeg) lightgray 50% / cover no-repeat",
            backgroundSize: "cover",
            backgroundPosition: "50%",
            backgroundRepeat: "no-repeat",
            backgroundBlendMode: "normal, normal, multiply",
          }}
        />
        <div
          className="absolute top-0 left-0 w-full h-[50px] pointer-events-none"
          aria-hidden="true"
          style={{
            background: "linear-gradient(180deg, #0C4256 0%, rgba(12, 66, 86, 0) 100%)",
          }}
        />

        <div className="relative w-full max-w-md z-10 mt-10">
          <div
            className="relative px-10 py-8 text-center text-[#F9F7EB] flex flex-col gap-4 items-center shadow-[0px_20px_60px_rgba(12,66,86,0.35)]"
            style={{
              borderRadius: "24px",
              background: "rgba(83, 44, 10, 0.65)",
              backdropFilter: "blur(6px)",
            }}
          >
            <div>
              <p className="italiana-regular-medium text-[28px]">¿No tenés cómo ir?</p>
              <p className="font-light text-base mt-2">
                Unite al grupo de whatsapp para coordinar traslados. Nos vemos!
              </p>
            </div>

            <Button
              className="rounded-full text-[#F9F7EB] px-6 py-2 flex items-center gap-2 transition-colors font-light"
              onClick={() => window.open('https://chat.whatsapp.com/GYzVFSKwBqDBKPN476fQ7D', '_blank')}
              style={{
                backgroundColor: "rgba(249, 247, 235, 0.20)",
                color: "#F9F7EB",
              }}
            >
              <MessageCircleHeart className="w-5 h-5" strokeWidth={1} />
              Unirse
            </Button>
          </div>
        </div>
      </section>
      <footer className="bg-[#0c4256] text-white py-5 md:py-10">
        <div className="max-w-6xl mx-auto px-">
          <div className="text-center mt-2">
            <p className="text-sm">invitia.uy - Diseño de páginas web para eventos.</p>
            <Button
              variant="link"
              asChild
              className="text-xs underline underline-offset-2 p-0 h-auto"
            >
              <Link href="/" className="text-white">Conocé más aquí</Link>
            </Button>
          </div>
        </div>
      </footer>
    </main>                                                                                                                                                                                                                                                                                                                                                                  
  )
};
