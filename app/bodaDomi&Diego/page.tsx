"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { FormEvent, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import { copyToClipboard } from "@/app/utils/copyToClipboard";
import { getTimeLeftToUruguayDate, type TimeLeft } from "@/app/utils/countdown";

const WEDDING_DATE_ISO = "2026-05-30T20:00:00-03:00";

export default function BodaDomiDiego() {
  const accountNumber = "1234567";
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
  });
  const [accountCopied, setAccountCopied] = useState(false);
  const [guestName, setGuestName] = useState("");
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

  /** Solo desktop (md+): abrir enlaces externos en pestaña nueva; en mobile, misma pestaña. */
  const [openExternalInNewTab, setOpenExternalInNewTab] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setOpenExternalInNewTab(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const update = () => {
      setTimeLeft(getTimeLeftToUruguayDate(WEDDING_DATE_ISO));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

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

      const response = await fetch("/api/rsvp/bodaDomiDiego", {
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
        throw new Error(
          errorBody?.error ??
            "No pudimos guardar tu respuesta. Intenta nuevamente.",
        );
      }

      setSubmissionFeedback({
        type: "success",
        message: "¡Gracias! Registramos tu respuesta.",
      });
      toast.success(
        attendanceResponse === "si"
          ? "¡Te esperamos!"
          : "¡Gracias por tu respuesta!",
        {
          position: "bottom-center",
          duration: 7000,
        },
      );
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

  const copyAccountNumber = async () => {
    try {
      await copyToClipboard(accountNumber);
      setAccountCopied(true);
      setTimeout(() => setAccountCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#667b5f] md:hidden hanken-grotesk-regular">
      <main className="relative z-10">
        <Toaster position="top-center" />
        <section className=" border-[20px] border-solid border-[#f1e7db] shadow-[inset_0_0_0_2px_#667b5f] text-[#667b5f] bg-[#f1e7db] relative flex min-h-screen flex-col items-center px-5 pt-[60px] text-center md:pt-[0px]">
          <div className="flex flex-col items-end justify-end w-full mr-20 text-[20px] text-[#89582b]">ב״ה
          <span className="block text-sm italic [direction:rtl]">
              מצאתי את שאהבה נפשי
            </span>
            <span className="mt-2 block text-xs italic">
              Encontré al que ama mi alma
            </span>
          </div>
       
          <div className="mb-2 mt-30 flex flex-col items-center my-auto leading-[0.88] md:flex-row md:items-baseline md:justify-center md:gap-6">
            <span className="instrument-serif-regular block text-[clamp(5rem,18vw,14rem)] uppercase font-bold md:text-8xl">
              Domi
            </span>
            <span className="font-dancing my-1 block text-6xl md:my-0 md:mb-0 md:mt-0 md:mx-[-10px] md:text-[100px]">
              &
            </span>
            <span className=" instrument-serif-regular block text-[clamp(5rem,18vw,14rem)] uppercase font-bold md:text-8xl">
              Diego
            </span>
            <div className="mt-8 md:mt-16 text-[#89582b]">
            <div className="text-[clamp(1.8rem,5vw,3rem)] font-light instrument-serif-regularmt-[-10px] md:mt-[-50px] md:text-4xl">
              30<span className="px-2 ">|</span>05
              <span className="px-2 ">|</span>26
            </div>
          </div>
          </div>
        

          {/* <img src="/bodaDomi&Diego/hero33.png" alt="Fondo" className="w-auto h-[250px] mb-10 mt-auto" /> */}
        </section>

        {/* DETALLES */}
        <div className="mt-10"></div>
        {/* <img src="/bodaDomi&Diego/ceremonia34.png" alt="Rings" className="w-auto h-[150px] mx-auto" /> */}
        <section
          id="detalles"
          className=" px-6 pb-5 text-center pt-10 bg-[#667b5f] text-[#f1e7db]"
        >
          <div className="mx-auto max-w-[700px]">
            {/* <h2 className="instrument-serif-regularuppercase mb-6 text-[clamp(2.5rem,7vw,4rem)] leading-none text-center">
              Ceremonia y Fiesta
            </h2> */}
            <span className="mb-4 block text-[2.5rem] instrument-serif-regular text-center">
              Ceremonia y Fiesta
            </span>

            <div className="mb-12 grid grid-cols-1 text-center md:grid-cols-2">
              <div className="p-6 md:border-r md:border-[#c8c0b4]">
                <span className="mb-3 block text-[0.95rem] font-bold uppercase text-[#3c4439] md:text-[0.8rem]">
                  Fecha
                </span>
                <div className="instrument-serif-regular text-[clamp(1.6rem,4vw,2.1rem)] leading-[1.3] md:text-[clamp(1.75rem,2.2vw,2.35rem)]">
                  Sábado 30 de Mayo, 2026
                  <br />
                  
                </div>
              </div>

              <div className="mx-auto h-px w-[60px] bg-[#3c4439] md:hidden" />

              <div className="p-6">
                <span className="mb-3 block font-bold text-[0.95rem] uppercase text-[#3c4439] md:text-[0.8rem]">
                  Hora
                </span>
                <div className="instrument-serif-regular text-[clamp(1.6rem,4vw,2.1rem)] leading-[1.3] md:text-[clamp(1.75rem,2.2vw,2.35rem)]">
                  20:00 hs
                </div>
                <div className="mt-1 text-[1.15rem] text-[#3c4439] md:text-lg">
                  Hasta las 4:00 am
                </div>
              </div>

              <div className="mx-auto h-px w-[60px] bg-[#3c4439] md:hidden" />

              <div className="p-6 md:col-span-2">
                <span className="mb-3 block font-bold text-[0.95rem] uppercase text-[#3c4439] md:text-[0.8rem]">
                  Lugar
                </span>
                <div className="instrument-serif-regular text-[clamp(1.6rem,4vw,2.1rem)] leading-[1.3] md:text-[clamp(1.75rem,2.2vw,2.35rem)]">
                  Regency Park Hotel, Jacksonville
                </div>
                <a
                  href="https://maps.app.goo.gl/1Jg77CGJmnvijbK7A"
                  target={openExternalInNewTab === true ? "_blank" : undefined}
                  rel={
                    openExternalInNewTab === true
                      ? "noopener noreferrer"
                      : undefined
                  }
                  className="mt-1 block text-[0.85rem] text-[#3c4439] underline underline-offset-2 transition hover:text-[#f5f3ef] hover:underline md:text-lg border-none outline-none"
                >
                  Ruta 8 KM 17, Montevideo, Uruguay
                </a>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="https://ul.waze.com/ul?venue_id=199165356.1991784633.7109267&overview=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location"
                target={openExternalInNewTab === true ? "_blank" : undefined}
                rel={
                  openExternalInNewTab === true
                    ? "noopener noreferrer"
                    : undefined
                }
                className="inline-block instrument-serif-regular border rounded-full  bg-transparent px-9 py-3.5 text-[1.5rem] uppercase transition hover:bg-[#f5f3ef] hover:text-[#1a1816]"
              >
                Cómo ir?
              </a>

              <a
                href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Boda+Domi+%26+Diego&dates=20260530T230000Z/20260531T070000Z&location=Regency+Park+Hotel%2C+Montevideo"
                target={openExternalInNewTab === true ? "_blank" : undefined}
                rel={
                  openExternalInNewTab === true
                    ? "noopener noreferrer"
                    : undefined
                }
                className="inline-block border rounded-full instrument-serif-regular bg-transparent px-9 py-3.5 text-[1.5rem] uppercase transition hover:bg-[#f5f3ef] hover:text-[#1a1816]"
              >
                Agendar
              </a>
            </div>
          </div>
        </section>
        <img src="/bodaDomi&Diego/ceremoniaabajo32.png" alt="Rings" className="w-auto h-[150px] mx-auto mb-20 mt-10" />

        {/* COUNTDOWN */}
        <section className="bg-[#101015] px-6 py-20 text-center bg-[#f1e7db]">
          <div className="">
            <span className="mb-4 block text-[2.5rem] text-[#667b5f] instrument-serif-regular">
              Faltan
            </span>
            <div className="flex flex-wrap justify-center gap-[clamp(16px,4vw,48px)]">
              <div className="flex flex-col items-center">
                <span className="instrument-serif-regular text-[clamp(3rem,10vw,6rem)] md:text-[clamp(1.5rem,5vw,3rem)] font-bold leading-none text-[#667b5f]">
                  {timeLeft.days}
                </span>
                <span className="mt-2 text-[0.65rem] uppercase text-[#667b5f]">
                  Días
                </span>
              </div>

              <span className="text-[#667b5f] instrument-serif-regular self-start pt-0.5 text-[clamp(3rem,10vw,6rem)] md:text-[clamp(1.5rem,5vw,3rem)] leading-none">
                :
              </span>

              <div className="flex flex-col items-center">
                <span className="instrument-serif-regular text-[clamp(3rem,10vw,6rem)] md:text-[clamp(1.5rem,5vw,3rem)] font-bold leading-none text-[#667b5f]">
                  {timeLeft.hours}
                </span>
                <span className="mt-2 text-[0.65rem] uppercase text-[#667b5f]">
                  Horas
                </span>
              </div>

              <span className="text-[#667b5f] instrument-serif-regular self-start pt-0.5 text-[clamp(3rem,10vw,6rem)] md:text-[clamp(1.5rem,5vw,3rem)] leading-none">
                :
              </span>

              <div className="flex flex-col items-center">
                <span className="instrument-serif-regular text-[clamp(3rem,10vw,6rem)] md:text-[clamp(1.5rem,5vw,3rem)] font-bold leading-none text-[#667b5f]">
                  {timeLeft.minutes}
                </span>
                <span className="mt-2 text-[0.65rem] uppercase text-[#667b5f]">
                  Minutos
                </span>
              </div>
            </div>
          </div>

          <img src="/bodaDomi&Diego/regalo.png" alt="Regalos" className="w-auto h-[150px] mx-auto mt-10 mb-5" />

          <div className=" px-5 pb-7 sm:px-10 sm:py-10">
            <div className="text-[0.9rem] uppercase text-[#89582b] md:text-[0.85rem]">
              Banco Itaú · Cuenta corriente
            </div>

            <div className="mt-5 flex flex-col items-center gap-2">
              <div className="flex items-center justify-center gap-3">
                <div className="instrument-serif-regular text-[30px] text-[#89582b]">
                  {accountNumber}
                </div>
                <button
                  type="button"
                  onClick={copyAccountNumber}
                  aria-label="Copiar número de cuenta"
                  className="inline-flex shrink-0 text-[#89582b] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f3ef]"
                >
                  <Copy className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} />
                </button>
              </div>
              <p className="mb-2 mt-[-10px] min-h-[1.25rem] text-sm text-[#89582b] md:min-h-[1.5rem] md:text-base">
                {accountCopied ? "✓ Copiado" : ""}
              </p>
            </div>

            <div className="mb-5">
              <div className="mb-1 text-[0.7rem] uppercasetext-[#89582b] md:text-[0.85rem]">
                Titular
              </div>
              <div className="text-[1.1rem] md:text-xl text-[#89582b]">Dominique Parnas</div>
            </div>
          </div>
        </section>

        {/* ASISTENCIA / RSVP */}
        <section id="asistencia" className=" px-6 py-20 text-center ">
          <div className=" max-w-[700px] bg-[#667b5f] rounded-lg m-5 p-5">
            {/* <h2 className="instrument-serif-regular mb-4 text-[clamp(2.5rem,7vw,4rem)] leading-none text-[#f1e7db]">
              Confirmá tu presencia
            </h2> */}
             <span className="mb-4 block text-[2.5rem] instrument-serif-regular text-center text-[#f1e7db]">
              Confirmá tu presencia
            </span>
            <p className="mb-10 text-sm text-[#f1e7db]">
              * antes del 15 de mayo
            </p>

            <div className=" px-5 text-left sm:px-10 sm:py-12">
              <form onSubmit={handleRsvpSubmit} className="space-y-6">
                <div className="flex flex-col gap-2 text-[#f1e7db]">
                  <label
                    htmlFor="guest-name-domi-diego"
                    className="text-[0.7rem] font-bold uppercase text-[#3c4439]"
                  >
                    Nombre y Apellido
                  </label>
                  <input
                    id="guest-name-domi-diego"
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Ej: María Rodríguez"
                    className="w-full border-b border-[#f1e7db]/40 bg-transparent px-0 py-3 text-[#f1e7db] placeholder:text-[#f1e7db]/70 focus:border-[#f1e7db] focus:outline-none"
                  />
                  <label
                    htmlFor="guest-name-domi-diego"
                    className="text-[0.7rem] font-small text-[#f1e7db]"
                  >
                    * Uno por persona
                  </label>
                </div>

                <div className="space-y-3">
                  <p className="text-[0.7rem] font-bold uppercase text-[#3c4439]">
                    Confirmar asistencia
                  </p>
                  <div className="flex flex-col gap-3 text-[#f1e7db]">
                    {[
                      { value: "si" as const, label: "Sí" },
                      { value: "no" as const, label: "No, lo siento" },
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
                          className="h-4 w-4 accent-[#f5f3ef]"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-[0.7rem] font-bold uppercase text-[#3c4439]">
                    Restricciones alimentarias
                  </p>
                  {[
                    { value: "no", label: "No" },
                    { value: "celiaco", label: "Celíaco/a" },
                    { value: "vegetariano", label: "Vegetariano" },
                    { value: "kosher", label: "Kosher" },
                    { value: "sin_gluten", label: "Sin gluten" },
                  ].map((option) => {
                    const checked = dietaryPreferences.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex items-center gap-3 text-[#f1e7db]"
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
                          className="h-4 w-4 rounded accent-[#f5f3ef]"
                        />
                        {option.label}
                      </label>
                    );
                  })}
                  <input
                    type="text"
                    value={otroText}
                    onChange={(e) => setOtroText(e.target.value)}
                    placeholder="Otra restricción"
                    className="w-full border-b border-[#f1e7db]/40 bg-transparent px-0 py-3 text-[#f1e7db] placeholder:text-[#f1e7db]/70 focus:border-[#f1e7db] focus:outline-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={true}
                  className="w-full rounded-full border border-[#f5f3ef] bg-transparent instrument-serif-regular py-6 text-[1.5rem]  font-normal uppercase text-[#f1e7db] hover:bg-[#f5f3ef]/90 disabled:opacity-50"
                >
                  {isSubmitting ? "Enviando..." : "Confirmar"}
                </Button>

                {submissionFeedback &&
                  submissionFeedback.type !== "success" && (
                    <p
                      className="text-center text-sm text-[#172e19]"
                      role="status"
                      aria-live="polite"
                    >
                      {submissionFeedback.message}
                    </p>
                  )}
              </form>
            </div>
          </div>
        </section>
        {/* <section>
          <Image
            src="/bodaDomi&Diego/perrodibujo.png"
            alt="Perro"
            width={200}
            height={200}
            className="w-full h-[300px] object-cover object-[50%_30%] md:h-[500px]"
          />
        </section> */}

        {/* FOOTER */}

        <footer className="py-5 md:py-10">
          <div className=" px-6 py-5 pb-0 text-center">
            {/* <div className="instrument-serif-regular mb-4 text-[clamp(2rem,6vw,3.5rem)] uppercase text-[#3c4439]">
              Domi y Diego
            </div> */}
            <span className="mb-4 block text-[2.5rem] uppercase instrument-serif-regular text-center text-[#3c4439]">
              Domi y Diego
            </span>
            <p className="text-[0.75rem] uppercase text-[#3c4439]">
              30 · 05 · 2026 <br />
              Montevideo, Uruguay
            </p>
          </div>
          <div className="h-[300px] w-full overflow-hidden">
          <img
            src="/bodaDomi&Diego/perro2.png"
            alt="Perro"
            className="h-full w-full object-cover object-center"
          />
        </div>
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
  );
}
