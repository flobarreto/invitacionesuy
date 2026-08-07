"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { CalendarIcon, MapPinIcon } from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { useInvitationCountdown } from "@/hooks/invitations/use-invitation-countdown";
import { useRsvpSubmission } from "@/hooks/invitations/use-rsvp-submission";
import { useInvitationCalendarUrl } from "@/hooks/invitations/use-invitation-calendar-url";

export default function BodaAndresLucre() {
  const timeLeft = useInvitationCountdown("andres-lucre");
  const calendarUrl = useInvitationCalendarUrl("andres-lucre");
  const {
    status: rsvpStatus,
    feedback: submissionFeedback,
    isSubmitting,
    ensureOpen,
    resetFeedback,
    setFeedback: setSubmissionFeedback,
    submit: submitRsvp,
  } = useRsvpSubmission("andres-lucre");
  const [copied, setCopied] = useState(false);
  const copyAccountNumber = async (accountNumber: string) => {
    try {
      await copyToClipboard(accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const [guestName, setGuestName] = useState("");
  const [attendanceResponse, setAttendanceResponse] = useState<"si" | "no">(
    "si",
  );
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([
    "no",
  ]);
  const [otroText, setOtroText] = useState("");
  const handleRsvpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (!ensureOpen()) return;

    if (!guestName.trim()) {
      setSubmissionFeedback({
        type: "error",
        message: "Por favor escribí tu nombre y apellido.",
      });
      return;
    }

    const validPreferences = dietaryPreferences
      .filter((p) => p !== "no" && p !== "otro" && !p.startsWith("otro:"))
      .filter((value, index, self) => self.indexOf(value) === index);

    const finalPreferences = otroText.trim()
      ? [...validPreferences, otroText.trim()].filter(
          (value, index, self) => self.indexOf(value) === index,
        )
      : validPreferences;

    const submitted = await submitRsvp({
      name: guestName.trim(),
      attendance: attendanceResponse,
      dietaryPreferences: finalPreferences,
    });
    if (!submitted) return;

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

    setTimeout(resetFeedback, 5000);
  };

  return (
    <main className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-[#fffaf4] font-cormorant-garamond">
      <Toaster position="top-center" />
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20 bg-black">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-4">
            <div className="text-8xl  text-[#fffaf4]  text-balance">Andrés</div>
            <div className="font-allura text-8xl  text-[#fffaf4]  text-balance">
              {" "}
              &{" "}
            </div>
            <div className="text-8xl  text-[#fffaf4]  text-balance mt-[-45px]">
              Lucre
            </div>

            <p className="text-[#fffaf4] text-xl mb-4 tracking-wide">
              ¡Nos casamos!
            </p>
          </div>
        </div>

        <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-[#688268]/20 blur-2xl"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 rounded-full bg-[#688268]/30 blur-3xl"></div>
      </section>

      <section className="px-6 py-20 md:px-12 md:py-28 bg-[#fffaf4]">
        <div className=" mx-auto text-center p-4">
          <div className="text-6xl font-semibold mb-2 font-allura">
            Nuestro Día
          </div>
          <div className="h-[0.5px] w-full bg-black mx-auto mb-10"></div>
          <div className="flex items-center text-xl w-full justify-center md:gap-12 md:text-2xl">
            <div
              className="w-[100px] h-[100px] md:w-[200px] md:h-[200px]"
              style={{
                backgroundImage: "url('/fotosAndres&Lucre/calendar.webp')",
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
            <div className="flex flex-col ml-[5px] w-full md:w-[300px] justify-start text-left">
              21 de marzo, 2026 <br />
              20:00 - 4:00
            </div>
          </div>
          <div className="space-y-4 flex flex-col items-center justify-start ">
            <div className="flex items-center text-xl md:gap-12 md:text-2xl">
              <div
                className="w-[100px] h-[100px] md:w-[200px] md:h-[200px]"
                style={{
                  backgroundImage: "url('/fotosAndres&Lucre/candles.webp')",
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              />
              <div className="flex flex-col mt-[5px] ml-[5px] w-full md:w-[300px] justify-start text-left">
                <p className="font-bold">Aras Dilema</p>
                <a
                  href="https://maps.app.goo.gl/LKjGNnx53HZs3u9V6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className=" text-sm font-normal mb-2 underline inline-block text-left"
                >
                  Alfredo Zitarrosa, 15000 Ciudad de la Costa
                </a>
                <a
                  href="https://ul.waze.com/ul?place=ChIJNZ83cdOJn5URGherrdKsQvE&ll=-34.82847510%2C-55.97936180&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center flex-row gap-2 text-sm md:text-xl font-normal mb-2 border-1 border-black/50 rounded-md px-2 py-1 mr-auto mb-[-20px]"
                >
                  <MapPinIcon className="w-5 h-5 text-black/50" strokeWidth={1} />
                  Cómo ir?
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        data-section
        className="px-6 py-20 md:px-12 md:py-28 bg-[#fffaf4]"
        style={{
          backgroundImage: "url('/fotosAndres&Lucre/test.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-2xl mx-auto text-center text-black py-2 px-4 bg-[#fffaf4] rounded-lg shadow-xl">
          <h2 className="text-4xl font-bold mt-6 font-allura md:text-6xl">
            Confirmá tu presencia
          </h2>
          <p className="leading-relaxed">antes del 14 de Marzo</p>
          <div className="h-[0.5px] w-full bg-black mx-auto mb-10"></div>

          <form
            onSubmit={handleRsvpSubmit}
            className="p-6 md:p-8 text-left space-y-6 rounded-lg"
          >
            <div className="flex flex-col gap-2">
              <label
                htmlFor="guest-name"
                className="text-sm font-semibold  tracking-wide"
              >
                Nombre y Apellido
              </label>
              <input
                id="guest-name"
                type="text"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Ej: María Rodríguez"
                className="w-full border-b border-black/60 pl-0 px-4 py-3  focus:outline-none focus:border-b-2 focus:border-black transition"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold  tracking-wide">
                Confirmar asistencia
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { value: "si", label: "Sí" },
                  { value: "no", label: "No, lo siento" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 cursor-pointer "
                  >
                    <input
                      type="radio"
                      name="attendance"
                      value={option.value}
                      checked={attendanceResponse === option.value}
                      onChange={() =>
                        setAttendanceResponse(option.value as "si" | "no")
                      }
                      className="h-4 w-4 border-black/50 accent-black focus:ring-black"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold  tracking-wide">
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
                    className="flex items-center gap-3 "
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
                            const withoutNo = prev.filter(
                              (value) => value !== "no",
                            );
                            if (withoutNo.includes(option.value))
                              return withoutNo;
                            return [...withoutNo, option.value];
                          }

                          return prev.filter((value) => value !== option.value);
                        });
                      }}
                      className="h-4 w-4 rounded border-black/50 accent-black focus:ring-black"
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
                className="w-full border-b border-black/60 pl-0 px-4 py-3  focus:outline-none focus:border-b-2 focus:border-black transition"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || rsvpStatus !== "open"}
              className="w-full bg-black hover:bg-black/90 disabled:bg-black/30 disabled:cursor-not-allowed disabled:text-black/60 text-[#fffaf4] font-semibold text-lg py-3 rounded-lg transition-colors"
            >
              {isSubmitting ? "Enviando..." : "Confirmar asistencia"}
            </Button>

            {submissionFeedback && submissionFeedback.type !== "success" && (
              <p
                className={`text-center text-sm font-medium 
                   "text-red-500"
                `}
                role="status"
                aria-live="polite"
              >
                {submissionFeedback.message}
              </p>
            )}
          </form>
        </div>
      </section>

      <section
        className="relative overflow-x-clip px-6 py-20 md:px-12 md:py-28 bg-[#fffaf4] md:px-[30%]"
        style={{
          backgroundImage: "url('/fotosAndres&Lucre/car.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute mt-[-20px] md:mt-[-38px] md:mt-[-45px] right-0 md:right-[22%] w-[156px] md:w-auto">
          <Image
            src="/fotosAndres&Lucre/bow.webp"
            alt=""
            width={120}
            height={180}
            className="object-contain h-auto max-h-40 md:max-h-48 w-auto"
          />
        </div>
        <div className="flex flex-col text-center bg-[#fffaf4]/90 p-4 rounded-lg text-black text-lg">
          <div className="text-6xl font-semibold mb-2 mt-4 font-allura">
            Regalos
          </div>
          <div className="h-[0.5px] w-full bg-black mx-auto mb-10"></div>
          <p>
            <b className="font-bold">Titular:</b> Andrés Pérez
          </p>
          <p>
            <b className="font-bold">Banco:</b> BROU{" "}
          </p>
          <p>
            <b className="font-bold">Tipo:</b> Caja de ahorro
          </p>
          <p>
            <b className="font-bold">Moneda:</b> Dólares
          </p>
          <p>
            <b className="font-bold">Cuenta:</b>{" "}
            <span
              role="button"
              tabIndex={0}
              className="cursor-pointer underline hover:opacity-80"
              onClick={() => copyAccountNumber("123456789-00001")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  copyAccountNumber("123456789-00001");
                }
              }}
            >
              123456789-00001
            </span>
          </p>
          <p className="text-sm min-h-[24px]">{copied && "✓ Copiado!"}</p>
        </div>
      </section>

      <section className="py-25 md:py-18 mt-[-2px] z-100 bg-black text-[#fffaf4]">
        <div className="max-w-4xl mx-auto px-6 text-center text-lg">
          Nos vemos en
          <div className="flex justify-center items-center gap-4 font-allura mt-4">
            <div className="text-center">
              <div className=" text-6xl md:text-6xl mb-2">
                {timeLeft.days} d.
              </div>
            </div>

            <div className="text-center">
              <div className=" text-6xl md:text-6xl mb-2">
                {timeLeft.hours} h.
              </div>
            </div>

            <div className="text-center">
              <div className=" text-6xl md:text-6xl mb-2">
                {timeLeft.minutes} m.
              </div>
            </div>
          </div>
            <a
              href={calendarUrl}
              target="_blank"
                  rel="noopener noreferrer"
                  className="flex mx-auto w-[150px] justify-center h-[40px] items-center flex-row gap-2 text-md md:text-2xl font-normal mb-4 border-1 border-[#fffaf4] rounded-md px-2 py-1 mr-auto mt-6"
                >
                  <CalendarIcon className="w-5 h-5 text-[#fffaf4]" strokeWidth={1} />
                  Agendar
                </a>

          <p className=" text-sm mt-2">Vestimenta Formal</p>
        </div>
      </section>

      <section
        className="relative px-6 md:py-30 md:px-12 md:py-28 bg-[#fffaf4] md:h-[800px] h-[500px] flex items-start md:items-center justify-center bg-[url('/fotosAndres&Lucre/them2.png')] md:bg-[url('/fotosAndres&Lucre/them2Web.png')]"
        style={{

          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="text-center md:text-2xl text-xl mt-12 bg-[#fffaf4]/90 p-4 rounded-lg w-[90%] md:w-[50%] mx-auto py-6 md:mb-60">

          A disfrutar este momento
          <br /> especial con nosotros
          <div className="md:text-6xl text-4xl font-bold mt-6 font-allura text-2xl">
            Es lo que nos <br />
            merecemos ♥
          </div>
        </div>
      </section>

      <footer
        className="bg-black text-[#fffaf4] py-5 md:py-10 font-montserrat"
        onClick={() => {
          window.location.href = "/";
        }}
      >
        <div className="max-w-6xl mx-auto px-auto text-center">
          <p className="text-lg">invitia.uy</p>
          <p className="text-sm mt-2">Páginas web unicas para eventos</p>
          <p className="text-xs">Click para conocer más</p>
        </div>
      </footer>
    </main>
  );
}
