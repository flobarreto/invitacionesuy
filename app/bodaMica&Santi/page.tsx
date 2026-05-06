"use client";

import {
  CalendarHeart,
  Clock,
  MapPin,
  PartyPopper,
  Church,
  Shirt,
  MessageCircleHeart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState, useEffect, useRef, TransitionEvent } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
}

const SAVE_THE_DATE_LINES = [
  { text: "SAVE", className: "text-[#8B6F5E]/80 text-[130px] text-balance" },
  {
    text: "the",
    className:
      "text-[#8B6F5E]/80 text-[100px] font-tangerine tracking-wide mt-[-50px] mb-[-70px]",
  },
  {
    text: "DATE",
    className: "text-[#8B6F5E]/80 text-[130px] mb-6 text-balance",
  },
] as const;

const SAVE_THE_DATE_STAGGER_MS = 100;
const SAVE_THE_DATE_LETTER_MS = 280;
const SAVE_THE_DATE_HOLD_MS = 1000;

const SAVE_THE_DATE_LETTER_COUNT = SAVE_THE_DATE_LINES.reduce(
  (n, line) => n + line.text.length,
  0,
);

const SAVE_THE_DATE_HIDE_AFTER_MS =
  (SAVE_THE_DATE_LETTER_COUNT - 1) * SAVE_THE_DATE_STAGGER_MS +
  SAVE_THE_DATE_LETTER_MS +
  SAVE_THE_DATE_HOLD_MS;

const GOOGLE_CALENDAR_EVENT_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Boda+Mica+%26+Santi&dates=20261017T180000%2F20261018T030000&ctz=America%2FMontevideo&details=%C2%A1Guardate+la+fecha+de+nuestro+casamiento+para+que+no+te+olvides+y+puedas+compartir+con+nosotros%21";

/** Navegador web “completo”: evita target=_blank en WebViews / apps in-app donde suele fallar. */
function isFullWebBrowser(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent;
  return !/FBAN|FBAV|Instagram|Line\/|; wv\)|\bWebView\b/i.test(ua);
}

export default function BodaMicaSanti() {
  const [drinkChoices, setDrinkChoices] = useState<string[]>([]);
  const [otherDrink, setOtherDrink] = useState<string>("");
  const [favoriteSong, setFavoriteSong] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  type SaveTheDatePhase = "shown" | "out" | "gone";
  const [saveTheDatePhase, setSaveTheDatePhase] =
    useState<SaveTheDatePhase>("shown");
  const [revealSaveTheDateLetters, setRevealSaveTheDateLetters] =
    useState(false);
  const saveTheDatePhaseRef = useRef(saveTheDatePhase);
  saveTheDatePhaseRef.current = saveTheDatePhase;

  const [calendarLinkNewTab, setCalendarLinkNewTab] = useState(true);
  useEffect(() => {
    setCalendarLinkNewTab(isFullWebBrowser());
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setRevealSaveTheDateLetters(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const hideTimer = setTimeout(
      () => setSaveTheDatePhase("out"),
      SAVE_THE_DATE_HIDE_AFTER_MS,
    );
    return () => clearTimeout(hideTimer);
  }, []);

  const handleSaveTheDateTransitionEnd = (
    event: TransitionEvent<HTMLDivElement>,
  ) => {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== "opacity"
    )
      return;
    if (saveTheDatePhaseRef.current === "out") setSaveTheDatePhase("gone");
  };

  const handleRsvpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionFeedback(null);


    setIsSubmitting(true);

    try {
      const response = await fetch("/api/rsvp/bodaMicaSanti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drink: drinkChoices.includes("otro")
            ? [...drinkChoices.filter((v) => v !== "otro"), otherDrink.trim()].filter(Boolean)
            : drinkChoices,
          favoriteSong: favoriteSong.trim(),
          isSaveTheDate: true,
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
        message: "¡Gracias!",
      });

      setDrinkChoices([]);
      setOtherDrink("");
      setFavoriteSong("");

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
      {saveTheDatePhase !== "gone" && (
        <div
          className={`fixed inset-0 z-30 flex flex-col items-center justify-center bg-[#f9f2e5] bg-cover bg-center bg-no-repeat px-4 transition-opacity duration-[1400ms] ease-in-out pointer-events-none ${saveTheDatePhase === "shown" ? "opacity-100" : "opacity-0"
            }`}
          style={{
            backgroundImage: "url('/bodaMica%26Santi/hel2.png')",
          }}
          onTransitionEnd={handleSaveTheDateTransitionEnd}
        >
          <div className="max-w-4xl mx-auto text-center">
            {SAVE_THE_DATE_LINES.map((line, lineIndex) => {
              const letterOffset = SAVE_THE_DATE_LINES.slice(
                0,
                lineIndex,
              ).reduce((sum, l) => sum + l.text.length, 0);
              return (
                <p key={line.text} className={line.className}>
                  {line.text.split("").map((char, i) => {
                    const g = letterOffset + i;
                    return (
                      <span
                        key={`${line.text}-${i}-${char}`}
                        className={`inline-block transition-opacity ease-out ${revealSaveTheDateLetters ? "opacity-100" : "opacity-0"
                          }`}
                        style={{
                          transitionDuration: `${SAVE_THE_DATE_LETTER_MS}ms`,
                          transitionDelay: revealSaveTheDateLetters
                            ? `${g * SAVE_THE_DATE_STAGGER_MS}ms`
                            : "0ms",
                        }}
                      >
                        {char}
                      </span>
                    );
                  })}
                </p>
              );
            })}
          </div>
        </div>
      )}
      <section
        className={`relative z-10 min-h-screen flex flex-col items-center md:justify-start justify-between overflow-hidden bg-[#f9f2e5] pb-0 transition-opacity duration-[1400ms] ease-in-out ${saveTheDatePhase === "shown"
          ? "opacity-0 pointer-events-none"
          : "opacity-100"
          }`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-top bg-no-repeat md:hidden"
          style={{
            backgroundImage: "url('/bodaMica%26Santi/viñaMobile.png')",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-[-90px] top-0 hidden bg-cover bg-bottom bg-no-repeat md:top-28 md:block"
          style={{
            backgroundImage: "url('/bodaMica%26Santi/viña.png')",
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto w-full text-center">
          <div>
            <a
              href={GOOGLE_CALENDAR_EVENT_URL}
              target={calendarLinkNewTab ? "_blank" : "_self"}
              rel={calendarLinkNewTab ? "noopener noreferrer" : undefined}
            >
              <p className="text-[#895C28] text-2xl mt-20 tracking-wide md:text-6xl">
                17 · OCTUBRE · 2026
              </p>
            </a>
            <a
              href="https://maps.app.goo.gl/xnSWNpQYU9fHXazY6"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-[#8D8A40] no-underline transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B89080] focus-visible:ring-offset-2 rounded-sm"
            >
              <span className="ital block text-l tracking-wide md:text-2xl">
                VIÑA VARELA ZARRANZ
              </span>
              <span className="block text-sm -mb-4 md:text-xl">
                Montevideo, Uruguay
              </span>
            </a>
          </div>

          {/* <div className="relative w-90 md:w-80 mx-auto aspect-[5/3]">
            <Image
              src="/bodaMica%26Santi/boda_espalda.png"
              alt="Mica y Santi"
              fill
              className="object-contain"
            />
          </div>  */}

          {/* <div className="inline-flex items-center gap-3 rounded-full text-[#895C28] text-lg">
            <span>{timeLeft.days} d</span>
            <span className="text-[#895C28]/50">·</span>
            <span>{String(timeLeft.hours).padStart(2, "0")} h</span>
            <span className="text-[#895C28]/50">·</span>
            <span>{String(timeLeft.minutes).padStart(2, "0")} m</span>
          </div> */}
        </div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="font-tangerine text-7xl text-[#966200] mb-20 md:mt-10">
            Mica &amp; Santi
          </div>
        </div>
      </section>

      {/* Confirmar presencia */}
      <section
        className="relative overflow-hidden bg-[#FBF7F4] bg-cover bg-center bg-no-repeat px-4 py-20"
        style={{
          backgroundImage: "url('/bodaMica%26Santi/hel2.png')",
        }}
      >
        <div className="max-w-2xl md:max-w-[70%] mx-auto text-center bg-white/40 md:bg-white/70 p-6 md:p-8 text-left rounded-md">
          <h2 className="text-lg md:text-3xl text-[#966200] mb-3 md:mb-10 text-balance text-center uppercase">
            Nuestros humanos se casan y queremos que seas parte desde el principio
          </h2>
          <form
            onSubmit={handleRsvpSubmit}
            className="  grid grid-cols-1 md:gap-6 md:grid-cols-2 md:items-start"
          >
            <div
              className="order-1 flex flex-col md:col-start-2 md:row-start-1"
              id="1"
            >
              <div className="flex justify-center my-2 ">
                <Image
                  src="/bodaMica&Santi/perros.png"
                  alt="Perros"
                  width={320}
                  height={320}
                  className="h-40 w-40 object-contain md:h-80 md:w-80"
                />
              </div>
            </div>

            {/*Drinking Choice + canción (fila completa en md) */}
            <div
              id="2"
              className="order-2 space-y-3 md:col-start-1 md:row-start-1"
            >
              <p className="text-sm md:text-lg text-[#966200] tracking-wide">
                ¿Qué te gustaría tomar?
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { value: "cerveza", label: "Cerveza" },
                  { value: "vino", label: "Vino" },
                  { value: "fernet", label: "Fernet" },
                  { value: "aperol", label: "Aperol" },
                  { value: "gin", label: "Gin" },
                  { value: "vodka", label: "Vodka" }
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 cursor-pointer text-[#8B6F5E]"
                  >
                    <input
                      type="checkbox"
                      name="drink"
                      value={option.value}
                      checked={drinkChoices.includes(option.value)}
                      onChange={() =>
                        setDrinkChoices((prev) =>
                          prev.includes(option.value)
                            ? prev.filter((v) => v !== option.value)
                            : [...prev, option.value],
                        )
                      }
                      className="h-4 w-4 accent-[#8D8A40] focus:ring-[#B89080]"
                    />
                    <span className="text-sm md:text-lg font-medium">
                      {option.label}
                    </span>
                  </label>
                ))}
                <label className="flex items-center gap-3 cursor-pointer text-[#8B6F5E]">
                  <input
                    type="text"
                    value={otherDrink}
                    onChange={(e) => {
                      setOtherDrink(e.target.value);
                      setDrinkChoices((prev) =>
                        e.target.value
                          ? prev.includes("otro") ? prev : [...prev, "otro"]
                          : prev.filter((v) => v !== "otro"),
                      );
                    }}
                    placeholder="Otro"
                    className="flex-1 border-b border-[#8B6F5E]/50 px-3 py-1.5 text-sm text-[#8B6F5E] focus:outline-none focus:ring-2 focus:ring-[#B89080] transition"
                  />
                </label>
              </div>

              <div className="flex flex-col items-start gap-2 w-full">
                <Label
                  htmlFor="music-input"
                  className=" text-[#966200] text-sm md:text-lg tracking-[0] leading-[normal]"
                >
                  ¿Qué canción no puede faltar?
                </Label>

                <input
                  type="text"
                  value={favoriteSong}
                  onChange={(e) => setFavoriteSong(e.target.value)}
                  placeholder="Bad Bunny - Inolvidable"
                  className="flex-1 w-full  border-b border-[#8B6F5E]/50 px-3 py-1.5 text-sm text-[#8B6F5E] focus:outline-none focus:ring-2 focus:ring-[#B89080] transition"
                />
              </div>
            </div>

            <div
              id="3"
              className="order-3 flex flex-col gap-4 max-w-full mt-6 md:mt-0 md:flex-row md:col-span-2 md:row-start-2"
            >
              <Button
                type="submit"
                disabled={false}
                className="flex-1 bg-[#8D8A40] hover:bg-[#966200] disabled:bg-[#966200]/30 disabled:cursor-not-allowed disabled:text-white/80 text-white text-lg py-3 rounded-lg transition-colors"
              >
                {isSubmitting ? "Enviando..." : "Enviar respuesta"}
              </Button>
              <Button
                asChild
                className="flex-1 bg-[#827a71] hover:bg-[#827a71] disabled:bg-[#827a71]/30 disabled:cursor-not-allowed disabled:text-white/80 text-white text-lg py-3 rounded-lg transition-colors"
              >
                <a
                  href={GOOGLE_CALENDAR_EVENT_URL}
                  target={calendarLinkNewTab ? "_blank" : "_self"}
                  rel={calendarLinkNewTab ? "noopener noreferrer" : undefined}
                >
                  Agendar en mi calendario
                </a>
              </Button>

              {submissionFeedback && (
                <p
                  className={`text-center text-sm font-medium ${submissionFeedback.type === "success"
                    ? "text-[#B89080]"
                    : "text-red-500"
                    }`}
                  role="status"
                  aria-live="polite"
                >
                  {submissionFeedback.message}
                </p>
              )}
            </div>
          </form>
        </div>
      </section>

      <footer className="bg-gray-200 py-5 md:py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center text-gray-600 mt-2">
            <p className="text-sm">
              invitia.uy - Diseño de páginas web para eventos.
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
