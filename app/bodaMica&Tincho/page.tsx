"use client";

import { CalendarHeart, Clock, MapPin, PartyPopper, Church, Shirt, MessageCircleHeart } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { FormEvent, useState } from "react";

export default function BodaMicaTincho() {
  const [copied, setCopied] = useState(false);
  const copyAccountNumber = async (accountNumber: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(accountNumber);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
      } else {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = accountNumber;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const [guestName, setGuestName] = useState("");
  const [attendanceResponse, setAttendanceResponse] = useState<"si" | "no">("si");
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(["no"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

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
      const response = await fetch("/api/rsvp/bodaMicaTincho", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: guestName.trim(),
          attendance: attendanceResponse,
          dietaryPreferences,
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
    <main className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-soft-white">
      {/* Hero Section */}
      <section
        className="relative min-h-screen flex items-center justify-center px-4 py-20"
        style={{
          backgroundImage: "url('/FotosMartin&Mica/backgroundBenta.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          width: "100%",
          height: "100%",
          padding: "0",
        }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-4">
            <p className="text-[#827a71]/60 text-xl mb-4 tracking-wide">¡Nos casamos!</p>
            <div className="dynalight-regular text-6xl md:text-8xl text-[#827a71] mb-2 text-balance text-2xl">Mica & Tincho</div>
          </div>

          <a
            href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Boda+Mica+%26+Tincho&dates=20260131T200000Z/20260201T090000Z&details=%C2%A1Guardate+la+fecha+de+nuestro+casamiento+para+que+no+te+olvides+y+puedas+compartir+con+nosotros%21"
            target="_blank"
            rel="noopener noreferrer"
          >
          <p className="text-[#827a71]/60 text-xl mb-4 tracking-wide">31 DE ENERO 2026</p>
          </a>

        </div>

        <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-[#688268]/20 blur-2xl"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 rounded-full bg-[#688268]/30 blur-3xl"></div>
      </section>


      <section className="py-20 px-4 bg-[#827a71]/50">
        <div className="max-w-6xl mx-auto">

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg p-8 shadow-lg hover:shadow-xl transition-shadow flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-[#688268]/10 rounded-full flex items-center justify-center mb-2">
                <Church className="w-8 h-8 text-[#688268]" />
              </div>
              <h3 className="text-4xl font-bold text-[#827a71] mb-4 ">Ceremonia</h3>
              <p className="text-lg text-[#827a71]/80 mb-1 leading-relaxed">Instituto Pre Universitario Juan XXIII</p>
              <div className="flex items-center gap-2 text-[#827a71]/70">
                <Clock className="w-5 h-5 text-[#688268]" />
                <span className="text-lg" >17:30 hs (Puntual)</span>
              </div>
              <div className="flex items-center gap-2 text-[#827a71]/70">
                <a
                  href="https://www.google.com/maps/dir//Mercedes+1769,+11200+Montevideo,+Departamento+de+Montevideo/@-34.9008734,-56.2616841,12z/data=!4m8!4m7!1m0!1m5!1m1!1s0x959f804addaf66db:0xb2a1afe84dea7203!2m2!1d-56.1792823!2d-34.9009023?entry=ttu&g_ep=EgoyMDI1MTAwMS4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="mt-6 bg-transparent border-1 border-[#688268] hover:bg-[#688268]/60 text-[#688268] font-semibold">
                    <MapPin className="w-8 h-8 text-[#688268]" />
                    Google Maps
                  </Button>
                </a>
                <a
                  href="https://www.waze.com/es/live-map/directions/uy/departamento-de-montevideo/montevideo/instituto-preuniversitario-juan-xxiii?to=place.ChIJ22av3UqAn5URA3LqTeivobI"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="mt-6 bg-transparent border-1 border-[#827a71] hover:bg-[#827a71]/60 text-[#827a71] font-semibold">
                    <MapPin className="w-8 h-8 text-[#827a71]" />
                    Waze
                  </Button>
                </a>
              </div>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-lg hover:shadow-xl transition-shadow flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-[#688268]/20 rounded-full flex items-center justify-center mb-2">
                <PartyPopper className="w-8 h-8 text-[#688268]" />
              </div>
              <h3 className="text-4xl font-bold text-[#827a71] mb-4">Fiesta</h3>
              <p className="text-lg text-[#827a71]/80 mb-1 leading-relaxed">Haras Los Vagones</p>
              <div className="flex items-center gap-2 text-[#827a71]/70 ">
                <Shirt className="w-5 h-5 text-[#688268]" />
                <span className="text-lg">Vestimenta: Formal</span>
              </div>
              <div className="flex items-center gap-2 text-[#827a71]/70">
                <a
                  href="https://www.google.com/maps/dir//Cno.+de+la+Redenci%C3%B3n+8660,+12500+Montevideo,+Departamento+de+Montevideo/@-34.7805561,-56.3758928,12z/data=!4m8!4m7!1m0!1m5!1m1!1s0x95a1d1804707f00d:0x30fde4205a107e56!2m2!1d-56.2934917!2d-34.7805839?entry=ttu&g_ep=EgoyMDI1MTAwMS4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                   <Button className="mt-6 bg-transparent border-1 border-[#688268] hover:bg-[#688268]/60 text-[#688268] font-semibold">
                    <MapPin className="w-8 h-8 text-[#688268]" />
                    Google Maps
                  </Button>
                </a>
                <a
                  href="https://www.waze.com/es/live-map/directions/uy/departamento-de-montevideo/montevideo/haras-los-vagones?to=place.ChIJDfAHR4DRoZURVn4QWiDk_TA"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="mt-6 bg-transparent border-1 border-[#827a71] hover:bg-[#827a71]/60 text-[#827a71] font-semibold">
                    <MapPin className="w-8 h-8 text-[#827a71]" />
                    Waze
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-light-bg">
        <div className="max-w-6xl mx-auto">

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/BentaPrincipal.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image //1
                src="/FotosMartin&Mica/Picture1.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/Picture2.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/Picture3.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg md:hidden">
              <Image
                src="/FotosMartin&Mica/Picture4.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg md:hidden">
              <Image
                src="/FotosMartin&Mica/Picture5.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/Picture8.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/Picture9.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/Picture10.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover object-bottom group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/Picture11.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>

        </div>
      </section>

      <section className="bg-[#688268]/50 py-8 md:py-10">
        <div className="max-w-5xl mx-auto px-6 text-center items-center justify-center flex">

          <div className="bg-white rounded-lg p-8 shadow-lg hover:shadow-xl transition-shadow flex flex-col items-center text-center pb-2 max-w-[400px]">
            <div className="w-16 h-16 bg-[#688268]/10 rounded-full flex items-center justify-center mb-6">
              <div className="inline-block text-white text-4xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#688268" }} className="lucide lucide-gift-icon lucide-gift"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></svg>
              </div>
            </div>
            <ul className="space-y-2 text-md text-[#688268]">
              <li>
                <strong>Titular de la cuenta:</strong> Micaela Botta
              </li>
              <li>
                <strong>Banco:</strong> BROU
              </li>
              <li>
                <strong>Cuenta Dólares:</strong>
                <span
                  className="cursor-pointer hover:text-[#e9ded0] transition-colors underline ml-1"
                  onClick={() => copyAccountNumber("001405985-00005")}
                >
                  001405985-00005
                </span>
              </li>
              <li>
                <strong>Cuenta Pesos:</strong>  <span
                  className="cursor-pointer hover:text-[#e9ded0] transition-colors underline ml-1"
                  onClick={() => copyAccountNumber("001405985-00004")}
                >


                  001405985-00004
                </span>
              </li>
              <p className="ml-2 text-sm h-[30px]">

                {copied && '✓ Copiado!'}
              </p>
            </ul>
          </div>
        </div>
      </section>

      <section className="px-4 bg-[url('/FotosMartin&Mica/confirmarPresenciaMobile.png')] md:bg-[url('/FotosMartin&Mica/confirmarPresenciaDesktop.png')] bg-cover bg-top bg-no-repeat py-[150px] md:py-20"  >
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-[#827a71] mb-3 mt-6 text-balance">Confirmá tu presencia</h2>
          <p className="text-xl text-[#827a71]/70 mb-8 leading-relaxed">
            Nos vemos el 31 de enero!
          </p>

          <form
            onSubmit={handleRsvpSubmit}
            className="bg-white/90  p-6 md:p-8 text-left space-y-6 "
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="guest-name" className="text-sm font-semibold text-[#827a71] uppercase tracking-wide">
                Nombre y Apellido
              </label>
              <input
                id="guest-name"
                type="text"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full rounded-lg border border-[#827a71]/30 bg-white/80 px-4 py-3 text-[#827a71] focus:outline-none focus:ring-2 focus:ring-[#688268] transition"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#827a71] uppercase tracking-wide">Confirmar asistencia</p>
              <div className="flex flex-col sm:flex-row gap-3">
                {[
                  { value: "si", label: "Sí" },
                  { value: "no", label: "No, lo siento" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex-1 cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${
                      attendanceResponse === option.value
                        ? "bg-[#688268] text-white border-[#688268]"
                        : "border-[#827a71]/30 text-[#827a71]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="attendance"
                      value={option.value}
                      checked={attendanceResponse === option.value}
                      onChange={() => setAttendanceResponse(option.value as "si" | "no")}
                      className="hidden"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-[#827a71] uppercase tracking-wide">
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
                    className="flex items-center gap-3 text-[#827a71]"
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
                      className="h-4 w-4 rounded border-[#827a71]/50 accent-[#688268] focus:ring-[#688268]"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !guestName.trim()}
              className="w-full bg-[#688268] hover:bg-[#827a71] disabled:bg-[#827a71]/30 disabled:cursor-not-allowed disabled:text-white/60 text-white font-semibold text-lg py-3 rounded-lg transition-colors"
            >
              {isSubmitting ? "Enviando..." : "Confirmar asistencia"}
            </Button>

            {submissionFeedback && (
              <p
                className={`text-center text-sm font-medium ${
                  submissionFeedback.type === "success" ? "text-[#688268]" : "text-red-500"
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


      <footer className="bg-[#827a71]/50 text-soft-white py-12 px-4 pb-15">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xl md:text-2xl font-bold mb-2 text-[#827a71]">No tenes como ir?</p>
          <p className=" text-[#827a71] text-md mb-3">
          Hicimos un grupo de whatsapp para que puedan coordinar transporte
          </p>
          <Button
            className="bg-transparent text-[#827a71] text-md rounded-md border-1 border-[#827a71]"
            style={{ textWrap: 'wrap' }}
            onClick={() => window.open('https://chat.whatsapp.com/FiEw3kgzvuLI3LQdHBR4bg', '_blank')}
          >
            <MessageCircleHeart className="w-10 h-10" />
           Unirme
          </Button>
        </div>
      </footer>

      <footer className="bg-gray-200 py-5 md:py-10">
        <div className="max-w-6xl mx-auto px-">
          <div className="text-center text-gray-600 mt-2">
            <p className="text-sm">Invitaciones.uy - Diseño de páginas web para eventos.</p>
            <Button
              variant="link"
              asChild
              className="text-xs text-[#688268] underline underline-offset-2 p-0 h-auto"
            >
              <Link href="/">Conocé más aquí</Link>
            </Button>
          </div>
        </div>
      </footer>
    </main>
  )
}
