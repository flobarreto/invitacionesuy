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
    const targetDate = new Date('2025-12-20T19:30:00').getTime()

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
    <main className="source-sans-3-font h-[100vh] w-full min-w-0 max-w-full overflow-x-clip bg-[#532C0A]">
      <section className="relative h-full bg-[#F9F7EB] py-[40px] px-[8px] flex flex-col justify-between border-b border-[#532C0A]">
        <div
          className="absolute bottom-0 left-0 w-full rounded-[166px_166px_0px_0px]"
          style={{
            background: `radial-gradient(81.64% 81.64% at 50% 81.64%, rgba(249, 247, 235, 0.00) 70%, #F9F7EB 100%), linear-gradient(180deg, rgba(83, 44, 10, 0.00) 0%, rgba(83, 44, 10, 0.00) 75.48%, #532C0A 100%), url('/bodaSofi&Gonchi/background.png') lightgray`,
            backgroundSize: 'cover',
            backgroundPosition: '50%',
            backgroundRepeat: 'no-repeat',
            backgroundBlendMode: 'normal, normal, multiply',
            height: '70%'
          }}>

        </div>

        <div className="text-[#095F7E] font-light flex flex-col items-center justify-center relative z-10">
          <p >¡NOS CASAMOS!</p>
          <p className="font-boska text-[#9E500B] text-[56px]">Sofi &amp; Gonchi</p>
          <p> 20 . DICIEMBRE . 2025</p>
        </div>

        <div className="flex flex-col items-center relative z-10">
          <Button asChild className="h-8 gap-2 mb-[16px] pl-3 pr-4 py-0 bg-[#0c4256] hover:bg-[#0c4256] rounded-[100px] transition-colors">
            <a href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Boda+Sofi+%26+Gonchi&dates=20251220T223000Z/20251221T013000Z&details=%C2%A1Guardate+la+fecha+de+nuestro+casamiento+para+que+no+te+olvides+y+puedas+compartir+con+nosotros%21" target="_blank" rel="noopener noreferrer">
              <CalendarIcon className="w-5 h-5" />
              <span className=" font-light text-[#f9f7eb] text-base text-center tracking-[0] leading-[normal] whitespace-nowrap">
                Agendar
              </span>
            </a>
          </Button>
          <div className="font-boska text-[#532C0A] text-[28px] inline-flex flex-col items-center gap-3 relative rounded-[1000px] bg-[rgba(249,247,235,0.75)] py-[12px] px-[32px]">
            {timeLeft.days} d . {String(timeLeft.hours).padStart(2, '0')} h . {String(timeLeft.minutes).padStart(2, '0')} m
          </div>
        </div>
      </section>

      <section className="bg-[#532C0A] max-w-[100%] min-h-[400px] text-[#F9F7EB] flex flex-wrap lg:gap-12 lg:flex-nowrap lg:flex-row flex-col items-center justify-center pt-6 border-t border-[#532C0A]">
        {eventSections.map((section) =>
          <div
            className="flex w-full lg:w-auto justify-center bg-[#532C0A] py-[24px]"
            key={section.id}
          >
            <div className="relative w-[312px] px-6">
              <div className="pointer-events-none absolute inset-x-0 top-10 bottom-10">
                <div className="h-full w-full border border-[#E8DCC8] rounded-t-[4rem]" />
                <div className="absolute left-1/2 -translate-x-1/2 -top-[1px] h-8 w-30 bg-[#532C0A]" />
                {!section.giftInformation && <div className="absolute left-1/2 -translate-x-1/2 -bottom-[1px] h-10 w-44 bg-[#532C0A]" />}
              </div>

              <img
                className={`absolute left-1/2 -top-2 -translate-x-1/2 object-contain ${section.iconHeight} w-auto`}
                alt={`${section.title} icon`}
                src={section.icon}
              />

              <div className="relative z-10 flex flex-col items-center text-center text-[#E8DCC8] pt-24 pb-20 gap-6 lg:h-[354px]">
                {section.giftInformation ? (
                  <div className="flex flex-col items-center font-light max-w-[80%]">
                    <p className="font-boska-medium text-[28px]">{section.title}</p>
                    <p className="mt-2 text-sm sm:text-base">
                      {section.locationName}
                    </p>
                    <p><b className="font-bold">Titular:</b> {section.giftInformation.name}</p>
                    <p><b className="font-bold">Banco:</b> {section.giftInformation.bank}</p>
                    <p>
                      <b className="font-bold">Cuenta:</b>{' '}
                      <span
                        className="underline cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          copyToClipboard(section.giftInformation.accountNumber)
                          setCopied(true)
                          setTimeout(() => setCopied(false), 2000)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            copyToClipboard(section.giftInformation.accountNumber)
                          }
                        }}
                      >
                        {section.giftInformation.accountNumber}
                      </span>
                    </p>
                    <p><b className="font-bold">Tipo:</b> {section.giftInformation.accountType}</p>
                    <p className="ml-2 text-sm h-[30px]">
                      {copied && '✓ Copiado!'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center font-light max-w-[85%]">
                      <p className="font-boska-medium text-[28px]">{section.title}</p>
                      <p className="mt-2 text-sm sm:text-base">{section.locationName}</p>
                      <a href={section.googleURL} target="_blank" rel="noopener noreferrer" className="mt-2 text-sm sm:text-base underline">
                        {section.locationAddress}
                      </a>

                      <Button
                      onClick={() => window.open(section.wazeURL, '_blank')}
                      rel="noopener noreferrer"
                      className="mt-6 rounded-[100px] bg-[rgba(249,247,235,0.20)] font-light text-[#E8DCC8] h-[32px]">
                        <MapPinIcon className="w-5 h-5" strokeWidth={1} />
                        ¿Cómo ir?
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {!section.giftInformation && (
                <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 flex flex-col items-center text-[#E8DCC8]">
                  <p className="font-boska-medium text-[28px]">{section.time}</p>
                  <p className="font-light text-[14px] tracking-[0.1em] uppercase mt-1">
                    {section.timeLabel}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      <section className="w-full justify-around gap-6 px-6 py-10 bg-[linear-gradient(180deg,rgba(83,44,10,1)_0%,rgba(12,66,86,1)_100%)] flex flex-col items-center">
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
              <h1 className="w-fit font-boska-medium text-[#532c0a] text-[28px] tracking-[0] leading-[normal] whitespace-nowrap">
                Asistencia
              </h1>

              <div className="flex flex-col items-start gap-2 w-full">
                <Label
                  htmlFor="name-input"
                  className="font-semibold text-[#532c0a] text-xs tracking-[0] leading-[normal]"
                >
                  Nombre y Apellido:
                </Label>

                <Input
                  id="name-input"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  className="flex text-[16px] items-center justify-center gap-2 px-3 py-2 w-full rounded border-[0.75px] border-solid border-[#532c0a] bg-transparent  text-[#745437] text-base tracking-[0] leading-[normal] h-auto"
                  placeholder="Ej. Gonzalo Puig"
                />
              </div>

              <div className="flex flex-col items-start gap-4 w-full">
                <Label className="font-semibold text-[#532c0a] text-xs tracking-[0] leading-[normal]">
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
                        className="w-5 h-5 rounded-full border border-[#532c0a] bg-[#f9f7ebcc] text-[#532c0a] data-[state=checked]:bg-[#532c0a] data-[state=checked]:border-[#532c0a] data-[state=checked]:shadow-[inset_0_0_0_3px_#f9f7ebcc] focus-visible:ring-[#532c0a]/30"
                      />
                      <Label
                        htmlFor={`attendance-${option.value}`}
                        className="font-light text-[#745437] text-base tracking-[0] leading-[normal] whitespace-nowrap cursor-pointer"
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex flex-col items-start gap-4 w-full">
                <Label className="font-semibold text-[#532c0a] text-xs tracking-[0] leading-[normal]">
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
                          className="w-5 h-5 rounded-[6px] border border-[#532c0a] bg-[#f9f7ebcc] text-[#532c0a] data-[state=checked]:bg-[#532c0a] data-[state=checked]:border-[#532c0a] focus-visible:ring-[#532c0a]/30"
                        />
                        <Label
                          htmlFor={`dietary-${option.value}`}
                          className="font-light text-[#745437] text-base tracking-[0] leading-[normal] whitespace-nowrap cursor-pointer"
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
                  className="font-semibold text-[#532c0a] text-xs tracking-[0] leading-[normal]"
                >
                  ¿Qué canción no puede faltar?
                </Label>

                <Input
                  id="music-input"
                  value={favoriteSong}
                  onChange={(event) => setFavoriteSong(event.target.value)}
                  placeholder="Comparte tu canción favorita"
                  className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded border-[0.75px] border-solid border-[#532c0a] bg-transparent text-[#745437] text-base tracking-[0] leading-[normal] h-auto"
                />
              </div>

              <div className="flex flex-col sm:flex-row w-full gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting || !guestName.trim()}
                  className={`flex-1 flex items-center justify-center gap-2 pl-3 pr-4 py-3 rounded-[100px] font-light text-[#f9f7eb] text-xl text-center tracking-[0] leading-[normal] whitespace-nowrap h-[40px] transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    isSuccessState ? "bg-[#532C0A] hover:bg-[#532C0A]" : "bg-[#0c4256] hover:bg-[#0c4256]"
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
              <p className="font-boska-medium text-[28px]">¿No tenés cómo ir?</p>
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
            <p className="text-sm">Invitia.uy - Diseño de páginas web para eventos.</p>
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
