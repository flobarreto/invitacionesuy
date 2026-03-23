"use client";

import { Button } from "@/components/ui/button";
import { CalendarIcon, MapPinIcon } from "lucide-react";
import { useState, useEffect, FormEvent } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
}

export default function BodaVirJere() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [attendanceResponse, setAttendanceResponse] = useState<"si" | "no">("si");
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(["no"]);
  const [otroText, setOtroText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    const calculateTimeLeft = () => {
      // Crear la fecha de la boda en hora de Uruguay (UTC-3)
      // 14 de marzo de 2026 a las 17:00 hora de Uruguay
      const weddingDate = new Date("2026-03-14T17:00:00-03:00");
      
      // Obtener la fecha y hora actual en hora de Uruguay
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Montevideo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      
      const parts = formatter.formatToParts(now);
      const year = parseInt(parts.find(p => p.type === "year")!.value);
      const month = parseInt(parts.find(p => p.type === "month")!.value) - 1;
      const day = parseInt(parts.find(p => p.type === "day")!.value);
      const hour = parseInt(parts.find(p => p.type === "hour")!.value);
      const minute = parseInt(parts.find(p => p.type === "minute")!.value);
      const second = parseInt(parts.find(p => p.type === "second")!.value);
      
      // Crear fecha actual en hora de Uruguay (UTC-3)
      const nowUruguay = new Date(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}-03:00`);
      
      // Calcular la diferencia en milisegundos
      const difference = weddingDate.getTime() - nowUruguay.getTime();

      if (difference > 0) {
        const days = Math.floor(
          difference / (1000 * 60 * 60 * 24)
        );
        const hours = Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor(
          (difference % (1000 * 60 * 60)) / (1000 * 60)
        );

        setTimeLeft({
          days: Math.max(0, days),
          hours: Math.max(0, hours),
          minutes: Math.max(0, minutes),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText("1313033");
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
      // Procesar dietaryPreferences: solo valores válidos (celiaco, veggie) y el texto de "otro" sin duplicados
      const validPreferences = dietaryPreferences
        .filter((p) => p !== "no" && p !== "otro" && !p.startsWith("otro:"))
        .filter((value, index, self) => self.indexOf(value) === index); // Eliminar duplicados
      
      // Agregar el texto de "otro" si existe
      const finalPreferences = otroText.trim()
        ? [...validPreferences, otroText.trim()].filter((value, index, self) => self.indexOf(value) === index)
        : validPreferences;

      const response = await fetch("/api/rsvp/bodaVirJere", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: guestName.trim(),
          attendance: attendanceResponse,
          dietaryPreferences: finalPreferences,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error ?? "No pudimos guardar tu respuesta. Intenta nuevamente.");
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
        message: error instanceof Error ? error.message : "Ocurrió un error inesperado. Intenta nuevamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip">
      <div className="min-h-screen relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/FotosVir&Jere/wedding-hero.png')",
          }}
        >
          <div className="absolute inset-0 bg-black/70"></div>
        </div>

        <div className="relative z-10 min-h-screen flex flex-col">

          <main className="flex-1 flex flex-col mt-8 text-center px-6 pb-10 md:mt-[20%]">
            <div className="">
              <p className="text-white/90 font-light font-sans text-lg md:text-xl tracking-wide">
                ¡NOS CASAMOS!
              </p>
            </div>

            <div className="mb-4">
              <h1 className="text-white font-italianno text-8xl lg:text-8xl font-light tracking-wide leading-tight">
                Vir y Jere
              </h1>
            </div>

            <div className="text-white mt-auto font-sans text-xl md:text-4xl tracking-[0.3em] font-light">
              14 . 03 . 26
            </div>
          </main>
        </div>
      </div>



      <section
        className="pt-25 pb-4 md:py-60 md:pb-10"
        style={{
          background: "linear-gradient(180deg, #4c4b46 0px, #e6e7eb 100px, #e6e7eb 100%)"
        }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 items-center">
            <div className="order-1 flex flex-col justify-center items-center text-center">
              <h2 className="font-italianno text-[60px] md:text-5xl text-[#9e1d2c] ">
                Ceremonia
              </h2>
              <div className="space-y-4 text-[#596047]">

                <div className="space-y-2">
                  <p className="font-sans text-md font-bold">
                    Parroquia Inmaculada Concepción
                  </p>
                  <a
                    href="https://www.google.com/maps/place/Parroquia+Inmaculada+Concepci%C3%B3n/@-30.8995492,-55.5428872,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fef6b92e400f:0x2a596e4443f79593!8m2!3d-30.8995492!4d-55.5403123!16s%2Fg%2F11c20c1wcx?entry=ttu&g_ep=EgoyMDI1MDgxMi4wIKXMDSoASAFQAw%3D%3D"
                    className="block font-sans text-md hover:text-gray-800 transition-colors underline mb-1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Monseñor Jacinto Vera 1083
                  </a>
                  <p className="font-sans text-base">Rivera, Uruguay</p>
                </div>
                <Button
                  onClick={() => window.open('https://www.waze.com/es/live-map/directions/uy/departamento-de-rivera/rivera/parroquia-inmaculada-concepcion?to=place.ChIJD0Auufb-qZURk5X3Q0RuWSo', '_blank')}
                  rel="noopener noreferrer"
                  variant="ghost"
                  className="mt-2 rounded-lg !bg-[rgba(89,96,71,0.7)] font-light text-white h-[32px] hover:!bg-[rgba(89,96,71,1)] border-0">
                  <MapPinIcon className="w-5 h-5" strokeWidth={1} />
                  ¿Cómo ir?
                </Button>

              </div>
              <p className="flex font-italianno items-center text-[#9e1d2c] text-[40px] font-medium w-full mt-2">
                <span className="flex-1 h-px bg-[#9e1d2c] mr-3" />
                17:00
                <span className="flex-1 h-px bg-[#9e1d2c] ml-3" />
              </p>
            </div>

            <div className="order-2 flex justify-center">
              <img
                src="/FotosVir&Jere/ceremony-couple.webp"
                alt="Vir y Jere"
                className="w-full h-80 md:h-96 object-cover rounded-lg shadow-lg"
              />
            </div>

            <div className="order-3 flex flex-col justify-center items-center text-center">
              <h2 className="font-italianno text-[60px] md:text-5xl text-[#9e1d2c] ">
                Fiesta
              </h2>
              <div className="space-y-4 text-[#596047]">

                <div className="space-y-2">
                  <p className="font-sans text-md font-bold">
                    Solar Dom Pedro Armour
                  </p>
                  <a
                    href="https://www.google.com/maps/place/Parroquia+Inmaculada+Concepci%C3%B3n/@-30.8995492,-55.5428872,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fef6b92e400f:0x2a596e4443f79593!8m2!3d-30.8995492!4d-55.5403123!16s%2Fg%2F11c20c1wcx?entry=ttu&g_ep=EgoyMDI1MDgxMi4wIKXMDSoASAFQAw%3D%3D"
                    className="block font-sans text-md hover:text-gray-800 transition-colors underline mb-1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    R. Jose Fernandes Mendes, 161
                  </a>
                  <p className="font-sans text-base">Sant'Ana do Livramento, Brazil</p>
                </div>
                <Button
                  onClick={() => window.open('https://www.waze.com/es/live-map/directions/br/rs/solar-dom-pedro?to=place.ChIJw1nj3vRVB5URYcm4loimufs', '_blank')}
                  rel="noopener noreferrer"
                  variant="ghost"
                  className="mt-2 rounded-lg !bg-[rgba(89,96,71,0.7)] font-light text-white h-[32px] hover:!bg-[rgba(89,96,71,1)] border-0">
                  <MapPinIcon className="w-5 h-5" strokeWidth={1} />
                  ¿Cómo ir?
                </Button>

              </div>
              <p className="flex font-italianno items-center text-[#9e1d2c] text-[40px] font-medium w-full mt-2">
                <span className="flex-1 h-px bg-[#9e1d2c] mr-3" />
                tras la ceremonia
                <span className="flex-1 h-px bg-[#9e1d2c] ml-3" />
              </p>
            </div>
          </div>
        </div>


        <div className="order-2 flex justify-center px-5 items-center mt-10 md:hidden">
          <img
            src="/FotosVir&Jere/rsvp-couple.webp"
            alt="Vir y Jere"
            className="w-full h-80 md:h-96 object-cover rounded-lg shadow-lg md:h-[700px] md:w-auto md:mt-20"
          />
        </div>

      </section>

      <section className="w-full justify-around gap-6 px-6 pb-25 bg-[linear-gradient(180deg,rgba(229,231,235,1)_0%,rgba(229,231,235,1)_80%,rgba(89,96,71,1)_100%)] flex flex-col items-center">

        <div className="relative z-10 max-w-2xl mx-auto text-center">

          <form
            onSubmit={handleRsvpSubmit}
            className=" p-6 md:p-8 text-left space-y-6 rounded-lg"
          >
            <h2 className="text-[45px] md:text-5xl text-center text-[#9e1d2c] mb-3 mt-6 font-italianno md:text-[60px]">Confirmá tu asistencia</h2>

            <div className="flex flex-col gap-2">
              <label htmlFor="guest-name" className="text-sm font-semibold text-[#596047] tracking-wide">
                Nombre y Apellido
              </label>
              <input
                id="guest-name"
                type="text"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Ej: María Rodríguez"
                className="w-full border-b border-[#596047]/30 pl-0 px-4 py-3 text-[#596047] focus:outline-none focus:border-b-2 focus:border-[#596047] transition"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#596047] tracking-wide">Confirmar asistencia</p>
              <div className="flex flex-col gap-3">
                {[
                  { value: "si", label: "Sí" },
                  { value: "no", label: "No, lo siento" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 cursor-pointer text-[#596047]"
                  >
                    <input
                      type="radio"
                      name="attendance"
                      value={option.value}
                      checked={attendanceResponse === option.value}
                      onChange={() => setAttendanceResponse(option.value as "si" | "no")}
                      className="h-4 w-4 border-[#596047]/50 accent-[#9e1d2c] focus:ring-[#9e1d2c]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-[#596047] tracking-wide">
                Restricciones Alimentarias
              </p>
              {[
                { value: "no", label: "No" },
                { value: "celiaco", label: "Celíaco/a" },
                { value: "veggie", label: "Veggie" },
              ].map((option) => {
                const checked = dietaryPreferences.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 text-[#596047]"
                  >
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={checked}
                      onChange={(event) => {
                        const isChecked = event.target.checked;
                        setDietaryPreferences((prev) => {
                          if (option.value === "no") {
                            if (isChecked) {
                              return ["no"];
                            }
                            return prev.filter((value) => value !== "no");
                          }

                          if (isChecked) {
                            const withoutNo = prev.filter((value) => value !== "no");
                            if (withoutNo.includes(option.value)) return withoutNo;
                            return [...withoutNo, option.value];
                          }

                          return prev.filter((value) => value !== option.value);
                        });
                      }}
                      className="h-4 w-4 rounded border-[#596047]/50 accent-[#9e1d2c] focus:ring-[#9e1d2c]"
                    />
                    {option.label}
                  </label>
                );
              })}
              <input
                type="text"
                value={otroText}
                onChange={(event) => setOtroText(event.target.value)}
                placeholder="Otra restricción"
                className="w-full border-b border-[#596047]/30 pl-0 px-4 py-3 text-[#596047] focus:outline-none focus:border-b-2 focus:border-[#596047] transition"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !guestName.trim()}
              className="w-full bg-[#596047] hover:bg-[#596047] disabled:bg-[#596047] disabled:cursor-not-allowed disabled:text-white text-white font-semibold text-lg py-3 rounded-lg transition-colors"
            >
              {isSubmitting ? "Enviando..." : "Confirmar asistencia"}
            </Button>

            {submissionFeedback && (
              <p
                className={`text-center text-sm font-medium ${submissionFeedback.type === "success" ? "text-[#9e1d2c]" : "text-[#9e1d2c]"
                  }`}
                role="status"
                aria-live="polite"
              >
                {submissionFeedback.message}
              </p>
            )}
          </form>

          <div className="order-2 flex justify-center px-5 items-center mt-10 hidden md:block">
          <img
            src="/FotosVir&Jere/rsvp-couple.webp"
            alt="Vir y Jere"
            className="w-full h-80 md:h-96 object-cover rounded-lg shadow-lg md:h-[700px] md:w-auto md:mt-20"
          />
        </div>

        </div>
      </section>

      <section
        className="py-25 md:py-18 mt-[-2px] z-100"
        style={{
          background: "linear-gradient(180deg, rgba(89, 96, 71, 1) 0%, rgba(229, 231, 235, 1) 100%)"
        }}
      >
        <div className="max-w-4xl mx-auto px-6 text-center text-sm">
          Nos vemos en
          <div className="flex justify-center items-center gap-4 font-italianno mt-4">

            <div className="text-center">
              <div className=" text-4xl md:text-6xl text-gray-800 mb-2">
                {timeLeft.days} d.
              </div>
            </div>

            <div className="text-center">
              <div className=" text-4xl md:text-6xl text-gray-800 mb-2">
                {timeLeft.hours} h.
              </div>
            </div>

            <div className="text-center">
              <div className=" text-4xl md:text-6xl text-gray-800 mb-2">
                {timeLeft.minutes} m.
              </div>
            </div>
          </div>

          <Button asChild className="h-8 gap-2 mb-[16px] pl-3 pr-4 py-0 bg-[#56544c] hover:bg-[#56544c]/80 rounded-lg mt-10 transition-colors">
            <a href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Boda+Vir+%26+Jere&dates=20260316T200000Z/20260316T230000Z&details=¡Te+esperamos+en+nuestra+boda%21+Confirmá+tu+asistencia+y+agendalo+acá%21"
              target="_blank" rel="noopener noreferrer">
              <CalendarIcon className="w-5 h-5" />
              <span className=" font-light text-[#f9f7eb] text-base text-center tracking-[0] leading-[normal] whitespace-nowrap">
                Agendar
              </span>
            </a>
          </Button>
          <p className="text-[#596047] font-sans text-sm mt-2">Vestimenta Formal</p>
        </div>
      </section>

      <section className="bg-[rgba(229,231,235,1)] py-8 h-[300px]"
      >
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="mb-8">
            <p className="text-[#9e1d2c] font-italianno text-3xl md:text-[55px] leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto">
              Si estas pensando en hacernos un regalo
            </p>
          </div>

          <div className="space-y-6 mb-2">
            <ul className="space-y-2 text-sm text-[#9e1d2c] md:text-lg">
              <li>
                <strong>Titular:</strong> Jeremías Berro
              </li>
              <li>
                <strong>Banco:</strong> Prex
              </li>
              <li>
                <strong>Cuenta:</strong>
                <span
                  className="cursor-pointer hover:text-white transition-colors underline ml-1"
                  onClick={copyAccountNumber}
                >
                  1313033
                </span>

                <p className="ml-2 text-sm h-[30px]">
                  {copied && '✓ Copiado!'}
                </p>

              </li>
            </ul>
          </div>
        </div>
      </section>
      <section className="py-15 md:py-12 md:pb-[150px]"
      style={{
        background: "linear-gradient(180deg, rgba(229, 231, 235, 1) 0%, rgba(86, 83, 75, 1) 100%)"
      }}
      >
        <div className="max-w-5xl mx-auto px-6 text-left mb-10">
          <div className="text-[#56534b] font-sans text-2xl md:text-2xl leading-relaxed text-left max-w-full sm:max-w-[80ch] mx-auto pb-4 rounded-lg p-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="dormir" className="border-[#e9ded0]/20">
                <AccordionTrigger className="text-[#56534b] font-sans text-xl md:text-2xl hover:no-underline">
                  Dónde dormir
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-4 justify-center pt-4">
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://www.smreservas.com/reservas/bodamazzoniberro.asp"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Hotel Like Design
                      </a>
                      <p className="text-[#56534b] font-sans text-sm">
                        20% OFF con el código: "BODA"
                      </p>
                      <p className="text-[#56534b] font-sans text-xs">
                        del 9 al 17 de marzo
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 py-3">
                      <a
                        href="https://www.frontierhotelrivera.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Hotel Frontier Rivera
                      </a>
                      <a className="text-[#56534b] font-sans text-sm hover:underline"
                        href="https://www.google.com/maps/place/frontier+hotel+rivera/data=!4m2!3m1!1s0x95a9fef7d2b46395:0x946e6bc033f6026c?sa=X&ved=1t:242&ictx=111"
                        target="_blank"
                      >
                        Ituzaingó 337 esq. Don Pedro de Ceballos, Rivera
                      </a>
                    </div>
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://riveracasinoresort.com/#"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Rivera Casino & Resort
                      </a>
                      <a className="text-[#56534b] font-sans text-sm hover:underline"
                        href="https://www.google.com/maps/place/Rivera+Casino+%26+Resort/@-30.8950269,-55.5397599,19.17z/data=!4m9!3m8!1s0x95a9fef77edd27d5:0xc86bba2ef0924437!5m2!4m1!1i2!8m2!3d-30.8952778!4d-55.5388889!16s%2Fg%2F1tfrnj6r?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                      >
                        Blv. 33 Orientales 1010, Rivera
                      </a>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="comer" className="border-[#e9ded0]/20">
                <AccordionTrigger className="text-[#56534b] font-sans text-xl md:text-2xl hover:no-underline">
                  Dónde comer
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-4 justify-center pt-4">
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://www.instagram.com/solar.gastronomia.cafe/?hl=es-la"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Solar Dom Pedro
                      </a>
                      <p className="text-[#56534b] font-sans text-sm">
                        10% OFF
                      </p>
                      <a
                        href="https://www.google.com/maps/place/Solar+Dom+Pedro/@-30.8975362,-55.5335914,21z/data=!4m15!1m8!3m7!1s0x95a9fe58dd977c0d:0x71473f431509b3a6!2sAv.+Jo%C3%A3o+Belchior+Goulart,+55+-+Centro,+Sant'Ana+do+Livramento+-+RS,+97574-001,+Brasil!3b1!8m2!3d-30.8974839!4d-55.5335186!16s%2Fg%2F11kb8fd976!3m5!1s0x95a9fe58dd9a2e69:0xa988f692d301b428!8m2!3d-30.8974767!4d-55.533529!16s%2Fg%2F11c1l70011?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        João Goulart, 55, Santana do Livramento
                      </a>
                    </div>
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://laperdiz.com.uy/index.php/rivera/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        La Perdiz Rivera
                      </a>
                      <a
                        href="https://www.google.com/maps/place/La+Perdiz/@-30.900349,-55.526782,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fe42ae374eb5:0x9802d7ecc8ebf5a1!8m2!3d-30.900349!4d-55.5242071!16s%2Fg%2F11bzq3qr9p?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        Plaza de comidas del shopping Siñeriz
                      </a>
                    </div>
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://www.instagram.com/restaurantepampagrill/?hl=es"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Pampa Grill
                      </a>
                      <a
                        href="https://www.google.com/maps/place/Pampa+Grill/@-30.8938846,-55.5356063,18.27z/data=!4m6!3m5!1s0x95a9fe57fe62c343:0x36c83a1e3c10eecd!8m2!3d-30.8938307!4d-55.5357572!16s%2Fg%2F11cs5n0fqv?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D "
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        R. Uruguai 1452, Sant'Ana do Livramento
                      </a>
                    </div>
                    <div className="flex flex-col gap-2">
                      <a
                        href="https://www.instagram.com/benedettosteakhouse/?hl=es"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Benedetto
                      </a>
                      <a
                        href="https://www.google.com/maps/place/Benedetto+Steakhouse/@-30.8966005,-55.5385088,20.26z/data=!4m6!3m5!1s0x95a9ff983937f6d3:0x8bce4cccdef68b0a!8m2!3d-30.8966172!4d-55.538273!16s%2Fg%2F11k4trl0mt?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        Don Pedro de Ceballos 1070, Rivera
                      </a>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="freeshops" className="border-[#e9ded0]/20">
                <AccordionTrigger className="text-[#56534b] font-sans text-xl md:text-2xl hover:no-underline">
                  Mejores Free Shops
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-4 justify-center pt-4">
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://www.sineriz.com.uy/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Siñeriz Shopping
                      </a>
                      <a
                        href="https://www.google.com/maps/place/Si%C3%B1eriz+Shopping/@-30.9000187,-55.5251471,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fe42c9ecd189:0xcdab2c3cbd336877!8m2!3d-30.9000187!4d-55.5251471!16s%2Fg%2F12323j9_v?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        João Goulart, 55, Santana do Livramento
                      </a>
                    </div>
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://www.dfauy.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        DFA
                      </a>
                      <a
                        href="https://www.google.com/maps/place/DFA+Rivera/@-30.898677,-55.5414539,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9ff62090edc73:0xf15027bdb4e1c3e6!8m2!3d-30.898677!4d-55.538879!16s%2Fg%2F1tj3m7x4?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        Av. Sarandí 475, Rivera
                      </a>
                    </div>
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://www.neutral.com.uy/shops/Rivera"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Neutral
                      </a>
                      <a
                        href="https://www.google.com/maps/place/Neutral+Free+Shop/@-30.8981268,-55.5443498,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fef7addf6a79:0x779614173024628!8m2!3d-30.8981269!4d-55.5394789!16s%2Fg%2F1td59t0q?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        Francisco Acuña de Figueroa 1068, Rivera
                      </a>
                    </div>
                    <div className="flex flex-col gap-2">
                      <a
                        href="https://www.baraofreeshop.com.br/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Barão
                      </a>
                      <a
                        href="https://www.google.com/maps/place/Bar%C3%A3o+Free+Shop/@-30.8970535,-55.5416008,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fef70f690685:0x1d58df0e3984c2fe!8m2!3d-30.8970535!4d-55.5390259!16s%2Fg%2F1t_h_4t5?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        Paysandú 1071, Rivera
                      </a>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="conocer" className="border-[#e9ded0]/20">
                <AccordionTrigger className="text-[#56534b] font-sans text-xl md:text-2xl hover:no-underline">
                  Conocé Rivera
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-4 justify-center pt-4">
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://www.google.com/search?q=plaza+internacional+rivera&oq=plaza+interna&gs_lcrp=EgZjaHJvbWUqDwgAEAAYFBiHAhjjAhiABDIPCAAQABgUGIcCGOMCGIAEMhIIARAuGBQYrwEYxwEYhwIYgAQyBwgCEAAYgAQyCQgDEEUYORiABDIHCAQQABiABDIHCAUQABiABDIHCAYQABiABDIHCAcQABiABDIHCAgQABiABDIHCAkQABiABNIBCDE3NDBqMGo3qAIIsAIB8QVBqX2dYhDpmvEFQal9nWIQ6Zo&sourceid=chrome&ie=UTF-8"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Plaza Internacional
                      </a>
                      <a
                        href="https://www.google.com/maps/place/Plaza+Internacional/@-30.8962053,-55.5378717,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fe587b122a5b:0xa18c901cc947fe5a!8m2!3d-30.8962053!4d-55.5352968!16s%2Fg%2F1td346tz?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        Plaza Internacional
                      </a>
                    </div>
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://www.cerrochapeu.com/?srsltid=AfmBOopWjmwLP6Lw_F_3MvxFNh8IAskFe9gmFD6MD89Ka-41Ew4YwszC"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Bodega Cerro Chapeu
                      </a>
                      <a
                        href="https://www.google.com/maps/place/Bodega+Cerro+Chapeu/@-30.9774647,-55.4481108,17z/data=!3m1!4b1!4m6!3m5!1s0x950757989502e7d9:0x56d72d07b6379c70!8m2!3d-30.9774647!4d-55.4455359!16s%2Fg%2F11c7wc_76p?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        Bodega Cerro Chapeu, Rivera
                      </a>
                    </div>
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://riveracasinoresort.com/#"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Casino
                      </a>
                      <a
                        href="https://www.google.com/maps/place/Rivera+Casino+%26+Resort/@-30.8952778,-55.5414638,17z/data=!3m1!4b1!4m9!3m8!1s0x95a9fef77edd27d5:0xc86bba2ef0924437!5m2!4m1!1i2!8m2!3d-30.8952778!4d-55.5388889!16s%2Fg%2F1tfrnj6r?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        Blv. 33 Orientales 1010, Rivera
                      </a>
                    </div>
                    <div className="flex flex-col gap-2 pb-3">
                      <a
                        href="https://www.rivera.gub.uy/portal/parque-gran-bretana/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#56534b] font-sans text-md md:text-lg leading-relaxed text-left max-w-full sm:max-w-[80ch] hover:text-white transition-colors underline"
                      >
                        Parque Gran Bretaña
                      </a>
                      <a
                        href="https://www.google.com/maps/place/Parque+Gran+Breta%C3%B1a/@-30.8701908,-55.6065387,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9f8a0f8bbb983:0x6597b6917cbcc87c!8m2!3d-30.8701908!4d-55.6039638!16s%2Fg%2F11b66bhvdw?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                        target="_blank"
                        className=" mb-3 text-[#56534b] font-sans text-xs hover:text-white transition-colors hover:underline">
                        Parque Gran Bretaña, Rivera
                      </a>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>


      <footer className="bg-[#56534b] text-white py-12 md:py-16" onClick={() => { window.location.href = 'https://invitia.uy'; }}>
        <div className="max-w-6xl mx-auto px-auto text-center">
            <p className="text-lg">invitia.uy</p>
            <p className="text-sm mt-2">Páginas web unicas para eventos</p>
            <p className="text-xs">Click para conocer más</p>
        </div>
      </footer>
    </div>
  );
}
