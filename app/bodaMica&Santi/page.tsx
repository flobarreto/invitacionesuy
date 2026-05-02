"use client";

import { CalendarHeart, Clock, MapPin, PartyPopper, Church, Shirt, MessageCircleHeart } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { FormEvent, useState, useEffect } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
}

export default function BodaMicaSanti() {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0 });
  const [guestName, setGuestName] = useState("");
  const [attendanceResponse, setAttendanceResponse] = useState<"si" | "no">("si");
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(["no"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const weddingDate = new Date("2026-10-17T19:00:00-03:00");

    const updateCountdown = () => {
      const now = new Date();
      const difference = weddingDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  const copyAccountNumber = async (accountNumber: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(accountNumber);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = accountNumber;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const handleRsvpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionFeedback(null);

    if (!guestName.trim()) {
      setSubmissionFeedback({ type: "error", message: "Por favor escribí tu nombre y apellido." });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/rsvp/bodaMicaSanti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      setSubmissionFeedback({ type: "success", message: "¡Gracias! Registramos tu respuesta." });
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
    <main
      className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip"
      style={{
        backgroundImage: "url('/bodaMica%26Santi/fondo.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >

      {/* Hero */}
      <section className="border-2 border-[#8D8A40]-200 m-2 relative min-h-screen flex flex-col items-center justify-center px-4 pb-0 pt-20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#8B6F5E]/80 text-4xl mb-4 tracking-wide font-semibold instrument-serif-regular ">SAVE the DATE</p>
          <div className="playwrite-norge text-4xl md:text-2xl text-[#895C28] mb-4">Mica &amp; Santi</div>
          <a
            href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Boda+Mica+%26+Santi&dates=20261114T220000Z/20261115T060000Z&details=%C2%A1Guardate+la+fecha+de+nuestro+casamiento+para+que+no+te+olvides+y+puedas+compartir+con+nosotros%21"
            target="_blank"
            rel="noopener noreferrer"
          >
            <p className="text-[#8D8A40] text-2xl mt-10 tracking-wide">17 DE OCTUBRE 2026</p>
          </a>

          <div className="inline-flex items-center gap-3 rounded-full text-[#895C28] text-lg">
            <span>{timeLeft.days} d</span>
            <span className="text-[#895C28]/50">·</span>
            <span>{String(timeLeft.hours).padStart(2, "0")} h</span>
            <span className="text-[#895C28]/50">·</span>
            <span>{String(timeLeft.minutes).padStart(2, "0")} m</span>
          </div>

          <div className="relative w-90 md:w-80 mx-auto aspect-[4/3]">
            <Image
              src="/bodaMica%26Santi/perros.png"
              alt="Mica y Santi"
              fill
              className="object-contain"
            />
          </div>

        </div>
        <div className="max-w-4xl mx-auto text-center">
          <p className="ital text-[#895C28] text-l mt-4 tracking-wide ">VIÑA VARELA ZARRANZ</p>
          <p className="text-[#8D8A40] text-sm">Montevideo, Uruguay</p>
        </div>
        <div className="relative w-full">
          <Image
            src="/bodaMica%26Santi/viña.png"
            alt=""
            width={1920}
            height={400}
            className="w-full object-cover object-top"
          />
        </div>
      </section>

      {/* Confirmar presencia */}
      <section className="px-4 bg-[#FBF7F4] py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-[#8B6F5E] mb-3 text-balance">Confirmá tu presencia</h2>
          <p className="text-xl text-[#8B6F5E]/70 mb-8 leading-relaxed">
            Nos vemos el 14 de noviembre!
          </p>

          <form
            onSubmit={handleRsvpSubmit}
            className="bg-white/90 p-6 md:p-8 text-left space-y-6"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="guest-name" className="text-sm font-semibold text-[#8B6F5E] uppercase tracking-wide">
                Nombre y Apellido
              </label>
              <input
                id="guest-name"
                type="text"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full rounded-lg border border-[#8B6F5E]/30 bg-white/80 px-4 py-3 text-[#8B6F5E] focus:outline-none focus:ring-2 focus:ring-[#B89080] transition"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#8B6F5E] uppercase tracking-wide">Confirmar asistencia</p>
              <div className="flex flex-col sm:flex-row gap-3">
                {[
                  { value: "si", label: "Sí" },
                  { value: "no", label: "No, lo siento" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex-1 cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${attendanceResponse === option.value
                      ? "bg-[#B89080] text-white border-[#B89080]"
                      : "border-[#8B6F5E]/30 text-[#8B6F5E]"
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
              <p className="text-sm font-semibold text-[#8B6F5E] uppercase tracking-wide">Restricciones Alimentarias</p>
              {[
                { value: "no", label: "No" },
                { value: "celiaco", label: "Celíaco/a" },
                { value: "veggie", label: "Veggie" },
              ].map((option) => {
                const checked = dietaryPreferences.includes(option.value);
                return (
                  <label key={option.value} className="flex items-center gap-3 text-[#8B6F5E]">
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={checked}
                      onChange={(event) => {
                        const isChecked = event.target.checked;
                        setDietaryPreferences((prev) => {
                          if (option.value === "no") {
                            return isChecked ? ["no"] : prev.filter((v) => v !== "no");
                          }
                          if (isChecked) {
                            const withoutNo = prev.filter((v) => v !== "no");
                            if (withoutNo.includes(option.value)) return withoutNo;
                            return [...withoutNo, option.value];
                          }
                          return prev.filter((v) => v !== option.value);
                        });
                      }}
                      className="h-4 w-4 rounded border-[#8B6F5E]/50 accent-[#B89080] focus:ring-[#B89080]"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>

            <Button
              type="submit"
              disabled={true}
              className="w-full bg-[#B89080] hover:bg-[#8B6F5E] disabled:bg-[#8B6F5E]/30 disabled:cursor-not-allowed disabled:text-white/60 text-white font-semibold text-lg py-3 rounded-lg transition-colors"
            >
              {isSubmitting ? "Enviando..." : "Confirmar asistencia"}
            </Button>

            {submissionFeedback && (
              <p
                className={`text-center text-sm font-medium ${submissionFeedback.type === "success" ? "text-[#B89080]" : "text-red-500"
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

      {/* WhatsApp */}
      <footer className="bg-[#8B6F5E]/50 text-soft-white py-12 px-4 pb-15">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xl md:text-2xl font-bold mb-2 text-[#8B6F5E]">¿No tenés cómo ir?</p>
          <p className="text-[#8B6F5E] text-md mb-3 mx-3">
            Hicimos un grupo de WhatsApp para que puedan coordinar transporte
          </p>
          <Button
            className="bg-transparent text-[#8B6F5E] text-md rounded-md border-1 border-[#8B6F5E]"
            style={{ textWrap: "wrap" }}
            onClick={() => window.open("https://chat.whatsapp.com/ENLACE_GRUPO", "_blank")}
          >
            <MessageCircleHeart className="w-10 h-10" />
            Unirme
          </Button>
        </div>
      </footer>

      <footer className="bg-gray-200 py-5 md:py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center text-gray-600 mt-2">
            <p className="text-sm">invitia.uy - Diseño de páginas web para eventos.</p>
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
