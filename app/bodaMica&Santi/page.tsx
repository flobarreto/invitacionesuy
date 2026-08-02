"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useState,
  MouseEvent,
  useEffect,
} from "react";

import { getTimeLeftToUruguayDate, type TimeLeft } from "@/app/utils/countdown";

const WEDDING_DATE_ISO = "2026-10-17T17:30:00-03:00";

const GOOGLE_CALENDAR_EVENT_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Boda+Mica+%26+Santi&dates=20261017T180000%2F20261018T030000&ctz=America%2FMontevideo&details=%C2%A1Guardate+la+fecha+de+nuestro+casamiento+para+que+no+te+olvides+y+puedas+compartir+con+nosotros%21";

/** .ics vía HTTPS: en iPhone, Safari entrega el evento a Calendario (evita el data: que suele forzar “descargar”). */
const APPLE_CALENDAR_EVENT_PATH = "/api/calendar/boda-mica-santi";

/** Solo iPhone (no iPad): el modal de elegir calendario. */
function isIPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone/.test(navigator.userAgent);
}

/** Teléfono / tablet: no abrir calendario en pestaña nueva. */
function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

const accountNumber = "8163122";

export default function BodaMicaSanti() {
  const [guestName, setGuestName] = useState("");
    const [copied, setCopied] = useState(false);

  const [attendanceResponse, setAttendanceResponse] = useState<"si" | "no">(
    "si",
  );
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([
    "no",
  ]);
  const [otroText, setOtroText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [calendarChoiceOpen, setCalendarChoiceOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
  });

    useEffect(() => {
      const update = () => {
        setTimeLeft(getTimeLeftToUruguayDate(WEDDING_DATE_ISO));
      };
      update();
      const timer = setInterval(update, 1000);
      return () => clearInterval(timer);
    }, []);

  /**
   * target siempre _self (mismo HTML en servidor y cliente → sin error de hidratación).
   * Escritorio: nueva pestaña vía window.open. Móvil: navegación normal. iPhone: modal.
   */
  const handleCalendarAnchorClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isIPhone()) {
      event.preventDefault();
      setCalendarChoiceOpen(true);
      return;
    }
    if (!isMobile()) {
      event.preventDefault();
      window.open(GOOGLE_CALENDAR_EVENT_URL, "_blank", "noopener,noreferrer");
    }
  };

  const openAppleCalendar = () => {
    setCalendarChoiceOpen(false);
    window.location.assign(APPLE_CALENDAR_EVENT_PATH);
  };

  const openGoogleCalendar = () => {
    setCalendarChoiceOpen(false);
    if (isMobile()) {
      window.location.assign(GOOGLE_CALENDAR_EVENT_URL);
      return;
    }
    window.open(GOOGLE_CALENDAR_EVENT_URL, "_blank", "noopener,noreferrer");
  };

    const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };


  const handleRsvpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionFeedback(null);

    if (!guestName.trim()) {
      setSubmissionFeedback({
        type: "error",
        message: "Por favor escribí tu nombre y apellido.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const validPreferences = dietaryPreferences
        .filter((p) => p !== "no" && p !== "otro" && !p.startsWith("otro:"))
        .filter((value, index, self) => self.indexOf(value) === index);

      const finalPreferences = otroText.trim()
        ? [...validPreferences, otroText.trim()].filter(
          (value, index, self) => self.indexOf(value) === index,
        )
        : validPreferences;

      const response = await fetch("/api/rsvp/bodaMicaSanti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: guestName.trim(),
          attendance: attendanceResponse,
          dietaryPreferences: finalPreferences,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(
          errorBody?.error ??
          "No pudimos guardar tu respuesta. Intenta nuevamente.",
        );
      }

      setSubmissionFeedback({
        type: "success",
        message: "¡Gracias! Registramos tu respuesta.",
      });

      setGuestName("");
      setAttendanceResponse("si");
      setDietaryPreferences(["no"]);
      setOtroText("");

      setTimeout(() => setSubmissionFeedback(null), 5000);
    } catch (error) {
      setSubmissionFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado. Intenta nuevamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip font-eb-garamond"
      style={{
        backgroundImage: "url('/bodaMica%26Santi/fondo.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <section id="hero" className="relative z-10 min-h-screen flex flex-col items-center md:justify-start justify-between overflow-hidden bg-[#f9f2e5] pb-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-top bg-no-repeat md:hidden"
          style={{
            backgroundImage: "url('/bodaMica%26Santi/hero.png')",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-cover bg-center bg-no-repeat md:block"
          style={{
            backgroundImage: "url('/bodaMica%26Santi/fondo-timeline.png')",
          }}
        />
        <div className="relative z-10 max-w-[80%] mx-auto text-center justify-end min-h-screen md:mt-auto flex flex-col items-center md:justify-center pb-[100px] md:pb-0">
          <div className="font-allura text-6xl md:text-[100px] text-[#966200]">
            Mica &amp; Santi
          </div>

          <Button
            asChild
            variant="ghost"
            className="pointer-events-auto h-auto min-h-0 p-0 text-[#895C28] shadow-none hover:bg-transparent hover:text-[#895C28] focus-visible:ring-2 focus-visible:ring-[#B89080] focus-visible:ring-offset-2 mt-6"
          >
            <a
              href={GOOGLE_CALENDAR_EVENT_URL}
              target="_self"
              rel="noopener noreferrer"
              onClick={handleCalendarAnchorClick}
            >
              <p className="text-[#895C28] text-md text-wrap uppercase tracking-wide md:text-2xl">
                Diecisiete de Octubre de Dos Mil Veintiséis
              </p>
            </a>
          </Button>

          <p className="text-[#966200] text-2xl md:text-3xl mt-12 tracking-wide">
            Viña Varela Zarranz
          </p>
          <p className="text-[#895C28] text-base md:text-lg tracking-[0.15em] mt-2">
            Montevideo · Uruguay
          </p>

          <p className="text-[#966200] font-eb-garamond italic text-lg md:text-xl tracking-wide mt-14 max-w-[85%] mx-auto leading-relaxed">
            Nos encantaría que nos acompañes en este día tan especial ♥
          </p>
        </div>
      </section>


    
      <section
        className="relative bg-cover bg-bottom bg-no-repeat px-4 py-20"
        style={{
          backgroundImage: "url('/bodaMica%26Santi/ceremonia.png')",
        }}
      >
        <div className="mx-auto flex flex-col items-center justify-center rounded-lg bg-[#FBF7F4]/90 p-8 max-w-[85%] text-center">
          <p className="font-allura text-xl md:text-2xl text-[#966200] mb-4">
            Ceremonia y Fiesta
          </p>
          <p className="text-[#966200] text-2xl font-medium">

          Viña Varela Zarranz
          </p>
          
          <a
              href="https://maps.app.goo.gl/xnSWNpQYU9fHXazY6"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[#B89080] no-underline transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B89080] focus-visible:ring-offset-2 rounded-sm"
            >
              <span className="block text-sm md:text-xl">
               74 km 29 · Joaquín Suárez · Canelones
              </span>
            </a>
          <Button className="bg-[#8D8A40] rounded-xl text-white mt-4 p-3 h-[30px]" onClick={() => window.open("https://ul.waze.com/ul?venue_id=199230893.1992046783.17618772&overview=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location", "_blank", "noopener,noreferrer")}>
            Cómo ir?
          </Button>
        </div>
      </section>
      <section className="bg-[#8B6F5E] py-8"
      >
          <div className="flex flex-col items-center justify-center py-4">
            <span className="text-2xl text-[#f9f2e5] font-allura">
              Faltan
            </span>
            <div className="flex flex-wrap justify-center text-4xl">
              <div className="flex flex-col items-center">
                <span className=" font-bold leading-none text-[#f9f2e5]">
                  {timeLeft.days}
                </span>
                <span className="mt-2 text-sm text-[#f9f2e5]">
                  Días
                </span>
              </div>

              <span className="text-[#f9f2e5]  self-start pt-0.5 leading-none">
                :
              </span>

              <div className="flex flex-col items-center">
                <span className=" font-bold leading-none text-[#f9f2e5]">
                  {timeLeft.hours}
                </span>
                <span className="mt-2 text-sm  text-[#f9f2e5]">
                  Horas
                </span>
              </div>

              <span className="text-[#f9f2e5]  self-start pt-0.5 leading-none">
                :
              </span>

              <div className="flex flex-col items-center">
                <span className=" font-bold leading-none text-[#f9f2e5]">
                  {timeLeft.minutes}
                </span>
                <span className="mt-2 text-sm  text-[#f9f2e5]">
                  Minutos
                </span>
              </div>
            </div>
          </div>

      </section>

       <section className="py-8 bg-white">
        <div className="max-w-5xl mx-auto px-6 text-center pb-6">
          <Image src="/bodaMica%26Santi/regalo.png" alt="Mesa de regalos" width={200} height={200} className="mx-auto mt-[-40px] mb-[-40px]" />
          <div className="space-y-6 mb-2">
            <ul className="space-y-2 text-md text-[#8D8A40] md:text-lg">
              <li>
                <strong>Titular:</strong> Santiago Romero
              </li>
              <li>
                <strong>Banco:</strong> Itaú
              </li>
                <li>
                  <strong>Tipo:</strong> Caja de ahorro USD
                </li>
              <li>
                <strong>Número:</strong>
                <span
                  className="cursor-pointer hover:text-white transition-colors underline ml-1"
                  onClick={copyAccountNumber}
                >
                  {accountNumber}
                </span>

                <p className="ml-2 text-sm h-[30px]">
                  {copied && '✓ Copiado!'}
                </p>

              </li>
            </ul>
          </div>
        </div>
      </section>
          <section className="bg-[#6b653a] py-10 md:py-20 justify-center flex flex-col items-center px-10 py-20 text-center ">
            <p className="text-[#f9f2e5] text-sm mb-4">
              Vestimenta Formal. Dress code formal. Les pedimos evitar el blanco, el beige y los tonos claros.
            </p>
            <Image src="/bodaMica%26Santi/vestimenta.png" alt="Vestimenta formal" width={400} height={180} className="mx-auto mb-4" />

      </section>
      <section className="relative bg-[#f9f2e5] px-4 py-20 flex flex-col items-center justify-center md:min-h-[900px] md:py-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-cover bg-center bg-no-repeat md:block"
          style={{
            backgroundImage: "url('/bodaMica%26Santi/fondo-timeline.png')",
          }}
        />
        <div className="relative z-10 mx-auto max-w-sm">
          <h2 className="mb-10 font-allura text-2xl text-[#966200] text-center">
            Timeline
          </h2>
          <div className="relative">
            <span className="absolute left-[116px] top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#8B6F5E]" />
            <div className="absolute left-[116px] top-0 bottom-0 w-px -translate-x-1/2 bg-[#8B6F5E]/50" />
            <span className="absolute left-[116px] bottom-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#8B6F5E]" />

            <ol className="grid grid-cols-[100px_1fr] items-center gap-x-4 gap-y-10 py-3">
              {[
                { time: "18:00 hrs", title: "Ceremonia", imageSrc: "/bodaMica%26Santi/0.png" },
                { time: "19:15 hrs", title: "Cocktail + live Jazz", imageSrc: "/bodaMica%26Santi/1.png" },
                { time: "20:30 hrs", title: "Apertura de pista", imageSrc: "/bodaMica%26Santi/5.png" },
                { time: "22:00 hrs", title: "Cena + vinos", imageSrc: "/bodaMica%26Santi/2.png" },
                { time: "23:00 hrs", title: "Baile", description:"* hasta 3:00am", imageSrc: "/bodaMica%26Santi/4.png" },
              ].map((event) => (
                <li key={event.title} className="contents">
                  <Image
                    src={event.imageSrc}
                    alt={event.title}
                    width={100}
                    height={100}
                    className="justify-self-center rounded-full"
                  />
                  <div className="flex items-center gap-4">
                    <span className="h-px w-5 shrink-0 bg-[#8B6F5E]/50" />
                    <div>
                      <p className="text-sm text-[#8B6F5E]">{event.time}</p>
                      <p className="text-sm text-[#8B6F5E]">{event.title}</p>
                      {event.description && (
                        <p className="text-xs text-[#8B6F5E]/80">{event.description}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
            <section
        id="asistencia"
        className="relative overflow-hidden bg-[#FBF7F4] bg-cover bg-center bg-no-repeat px-4 py-20"
      >
        <div className="max-w-xl mx-auto text-center p-6 md:p-10 rounded-md">
          <div className="mb-6">

          <h2 className="text-2xl md:text-3xl text-[#8D8A40] font-allura text-balance text-center mb-[-10px]">
            Asistencia
          </h2>
          <span className="text-xs text-[#8B6F5E]/80">
Por favor, confirmá antes del 1 de octubre
              </span>
          </div>

          <form onSubmit={handleRsvpSubmit} className="space-y-6 text-left">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="guest-name-mica-santi"
                className="text-[#966200] text-sm md:text-lg tracking-[0] leading-[normal]"
              >
                Nombre y Apellido
              </Label>
              <input
                id="guest-name-mica-santi"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ej: María Rodríguez"
                className="w-full border-b border-[#8B6F5E]/50 bg-transparent px-0 py-2 text-[#8B6F5E] placeholder:text-[#8B6F5E]/60 focus:outline-none focus:ring-2 focus:ring-[#B89080] transition"
              />
              <span className="text-xs text-[#8B6F5E]/80">
                * Uno por persona
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-sm md:text-lg text-[#966200] tracking-wide">
                Confirmar asistencia
              </p>
              <div className="flex flex-col gap-3 text-[#8B6F5E]">
                {[
                  { value: "si" as const, label: "Sí" },
                  { value: "no" as const, label: "No" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-3"
                  >
                    <input
                      type="radio"
                      name="attendance"
                      value={option.value}
                      checked={attendanceResponse === option.value}
                      onChange={() => setAttendanceResponse(option.value)}
                      className="h-4 w-4 accent-[#8D8A40]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm md:text-lg text-[#966200] tracking-wide">
                Restricciones alimentarias
              </p>
              {[
                { value: "no", label: "No" },
                { value: "celiaco", label: "Celíaco/a" },
                { value: "vegetariano", label: "Vegetariano" },
              ].map((option) => {
                const checked = dietaryPreferences.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 cursor-pointer text-[#8B6F5E]"
                  >
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={checked}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setDietaryPreferences((prev) => {
                          if (option.value === "no") {
                            if (isChecked) return ["no"];
                            return prev.filter((value) => value !== "no");
                          }
                          if (isChecked) {
                            const withoutNo = prev.filter(
                              (value) => value !== "no",
                            );
                            if (withoutNo.includes(option.value))
                              return withoutNo;
                            return [...withoutNo, option.value];
                          }
                          return prev.filter(
                            (value) => value !== option.value,
                          );
                        });
                      }}
                      className="h-4 w-4 rounded accent-[#8D8A40]"
                    />
                    <span className="text-sm md:text-lg font-medium">
                      {option.label}
                    </span>
                  </label>
                );
              })}
              <input
                type="text"
                value={otroText}
                onChange={(e) => setOtroText(e.target.value)}
                placeholder="Otra restricción"
                className="w-full border-b border-[#8B6F5E]/50 bg-transparent px-0 py-2 text-[#8B6F5E] placeholder:text-[#8B6F5E]/60 focus:outline-none focus:ring-2 focus:ring-[#B89080] transition"
              />
            </div>

            <div className="flex flex-col gap-4 max-w-full mt-6 md:mt-0 md:flex-row">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[#8D8A40] hover:bg-[#966200] disabled:bg-[#966200]/30 disabled:cursor-not-allowed disabled:text-white/80 text-white text-lg py-3 rounded-xl transition-colors"
              >
                {isSubmitting ? "Enviando..." : "Confirmar"}
              </Button>
            </div>

            {submissionFeedback && (
              <p
                className={`text-center text-sm font-medium ${submissionFeedback.type === "success"
                  ? "text-[#966200]"
                  : "text-red-500"
                  }`}
                role="status"
                aria-live="polite"
              >
                {submissionFeedback.message}
              </p>
            )}
          </form>
        </div>
      </section>
      <section className="bg-[#FBF7F4] px-4 pb-20 flex flex-col items-center justify-center text-center ">
        <div className="mx-auto max-w-[80%]">

        <h2 className="font-allura text-2xl text-[#966200]  mb-4">

      La bodega
</h2>
<div >

Varela Zarranz tiene más de un siglo de historia, rodeada de viñedos y naturaleza. <br/> Nos enamoró la tranquilidad del lugar, sus paisajes y el encanto de cada rincón. Esperamos que ustedes también lo sientan así.

</div>
        </div>
      </section>
      <Dialog open={calendarChoiceOpen} onOpenChange={setCalendarChoiceOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] border-[#8B6F5E]/30 bg-[#f9f2e5] text-[#5c4030] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-eb-garamond text-xl text-[#966200]">
              Agendar el evento
            </DialogTitle>
            <DialogDescription className="text-[#8B6F5E]">
              Elegí con qué calendario querés guardar la fecha.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <Button
              type="button"
              className="w-full bg-[#8D8A40] text-white hover:bg-[#966200]"
              onClick={openAppleCalendar}
            >
              Abrir con Calendario de Apple
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#8B6F5E]/50 bg-transparent text-[#5c4030] hover:bg-[#8B6F5E]/10"
              onClick={openGoogleCalendar}
            >
              Abrir con Google Calendar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="bg-[#f9f2e5] py-5 md:py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center text-gray-600 mt-2">
            <p className="text-sm">
              Hecho por invitia.uy
            </p>
            <Button
              variant="link"
              asChild
              className="text-xs text-[#B89080] underline underline-offset-2 p-0 h-auto"
            >
              <Link href="/">Conocé más aquí</Link>
            </Button>
          </div>
        </div>
      </footer>
    </main>
  );
}
