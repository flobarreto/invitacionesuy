"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface TimeLeft {
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function BodaVirJere() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const weddingDate = new Date("2026-03-14T17:00:00");
      const now = new Date();
      now.setMonth(now.getMonth() - 1);
      const difference = weddingDate.getTime() - now.getTime();

      if (difference > 0) {
        const months = Math.floor(difference / (1000 * 60 * 60 * 24 * 30.44));
        const days = Math.floor(
          (difference % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24)
        );
        const hours = Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor(
          (difference % (1000 * 60 * 60)) / (1000 * 60)
        );

        setTimeLeft({
          months: Math.max(0, months),
          days: Math.max(0, days),
          hours: Math.max(0, hours),
          minutes: Math.max(0, minutes),
          seconds: Math.max(0, Math.floor((difference % (1000 * 60)) / 1000)),
        });
      } else {
        setTimeLeft({ months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText("2607207");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="min-h-screen relative overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/FotosVir&Jere/wedding-hero.png')",
          }}
        >
          {/* Overlay for better text readability - adjust opacity here */}
          <div className="absolute inset-0 bg-black/70"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Navigation Header */}
          <header className="fixed w-full flex flex-col md:flex-row items-center justify-between gap-4 p-6 md:p-8">
            {/* Right RSVP Button */}
            <div className="md:ml-auto">
              <a
                href="https://docs.google.com/forms/u/0/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm font-sans text-sm px-6"
                >
                  Confirmar asistencia
                </Button>
              </a>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-20">
            {/* We're Getting Married */}
            <div className="mb-8">
              <p className="text-white/90 font-sans text-lg md:text-xl tracking-wide">
                ¡Nos casamos!
              </p>
            </div>

            {/* Couple Names */}
            <div className="mb-8">
              <h1 className="text-white font-italianno text-7xl lg:text-8xl font-light tracking-wide leading-tight">
                {/* TODOFLO: cambiar el nombre de los novios a curisva */}
                Vir y Jere
              </h1>
            </div>

            {/* Wedding Date */}
            <div className="text-white font-sans text-xl md:text-2xl tracking-[0.3em] font-light">
              14 . 03 . 26
            </div>
          </main>
        </div>
      </div>

      {/* Countdown Section */}
      <section className="bg-white py-15 md:py-18">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-serif text-2xl md:text-3xl text-gray-800 mb-10 tracking-wide">
            Faltan
          </h2>
          {/* todo flo: esto no anda en mobile  */}
          <div className="grid grid-cols-5">
            {/* Months */}
            <div className="text-center">
              <div className="font-serif text-4xl md:text-6xl text-gray-800 mb-2">
                {timeLeft.months}
              </div>
              <div className="font-sans text-sm md:text-base text-gray-600 tracking-wide uppercase">
                {timeLeft.months === 1 ? "Mes" : "Meses"}
              </div>
            </div>

            {/* Days */}
            <div className="text-center">
              <div className="font-serif text-4xl md:text-6xl text-gray-800 mb-2">
                {timeLeft.days}
              </div>
              <div className="font-sans text-sm md:text-base text-gray-600 tracking-wide uppercase">
                {timeLeft.days === 1 ? "Día" : "Días"}
              </div>
            </div>

            {/* Hours */}
            <div className="text-center">
              <div className="font-serif text-4xl md:text-6xl text-gray-800 mb-2">
                {timeLeft.hours}
              </div>
              <div className="font-sans text-sm md:text-base text-gray-600 tracking-wide uppercase">
                {timeLeft.hours === 1 ? "Hora" : "Horas"}
              </div>
            </div>

            {/* Minutes */}
            <div className="text-center">
              <div className="font-serif text-4xl md:text-6xl text-gray-800 mb-2">
                {timeLeft.minutes}
              </div>
              <div className="font-sans text-sm md:text-base text-gray-600 tracking-wide uppercase">
                {timeLeft.minutes === 1 ? "Minuto" : "Minutos"}
              </div>
            </div>

            {/* Seconds */}
            <div className="text-center">
              <div className="font-serif text-4xl md:text-6xl text-gray-800 mb-2">
                {timeLeft.seconds}
              </div>
              <div className="font-sans text-sm md:text-base text-gray-600 tracking-wide uppercase">
                {timeLeft.seconds === 1 ? "Segundo" : "Segundos"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#e9ded0] py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          {/* Main Message */}
          <div className="space-y-6">
            <p className="text-[#c63c71] font-serif text-xl md:text-2xl leading-relaxed">
              ¡Nos casamos! Queremos compartir con ustedes este día tan especial
              para nosotros.
            </p>
            <p className="text-[#c63c71]  font-serif text-xl md:text-2xl leading-relaxed">
              ¡Esperamos contar con su presencia para celebrar juntos!
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gray-200 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 items-center">
            {/* Ceremony Details */}
            <div className="order-1 flex flex-col justify-center items-center text-center">
              <h2 className="font-serif text-4xl md:text-5xl text-[#9e1d2c]  mb-6">
                Ceremonia
              </h2>
              <div className="space-y-4 text-[#596047]">
                <p className="font-serif text-2xl text-[#9e1d2c] md:text-3xl">
                  17:00
                </p>
                <div className="space-y-2">
                  <p className="font-sans text-lg font-medium">
                    Parroquia Inmaculada Concepción
                  </p>
                  <p className="font-sans text-base">
                    Monseñor Jacinto Vera 1083
                  </p>
                  <p className="font-sans text-base">Rivera, Uruguay</p>
                </div>
                <div className="pt-4">
                  <a
                    href="https://www.google.com/maps/place/Parroquia+Inmaculada+Concepci%C3%B3n/@-30.8995492,-55.5428872,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fef6b92e400f:0x2a596e4443f79593!8m2!3d-30.8995492!4d-55.5403123!16s%2Fg%2F11c20c1wcx?entry=ttu&g_ep=EgoyMDI1MDgxMi4wIKXMDSoASAFQAw%3D%3D"
                    className="block font-sans text-sm text-[#6778a8] hover:text-gray-800 transition-colors underline mb-1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Maps
                  </a>
                  <a
                    href="https://www.waze.com/es/live-map/directions/uy/departamento-de-rivera/rivera/parroquia-inmaculada-concepcion?to=place.ChIJD0Auufb-qZURk5X3Q0RuWSo"
                    className="block font-sans text-sm text-[#6778a8] hover:text-gray-800 transition-colors underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Waze
                  </a>
                </div>
              </div>
            </div>

            {/* Ceremony Image */}
            {/* TODOFLO: ponerle la sombra */}
            <div className="order-2 flex justify-center">
              <img
                src="/FotosVir&Jere/ceremony-couple.jpg"
                alt="Vir y Jere"
                className="w-full h-80 md:h-96 object-cover rounded-lg shadow-lg"
              />
            </div>

            {/* Party Details */}
            <div className="order-3 flex flex-col justify-center items-center text-center">
              <h2 className="font-serif text-4xl md:text-5xl text-[#9e1d2c] mb-6">
                Fiesta
              </h2>
              <div className="space-y-4 text-[#596047]">
                <p className="font-serif text-2xl md:text-3xl text-[#9e1d2c]">
                  {" "}
                  tras la ceremonia
                </p>
                <div className="space-y-2">
                  <p className="font-sans text-lg font-medium">
                    Solar Dom Pedro Armour
                  </p>
                  <p className="font-sans text-base">
                    R. Jose Fernandes Mendes, 161
                  </p>
                  <p className="font-sans text-base">
                    Sant'Ana do Livramento, Brazil
                  </p>
                </div>
                <div className="pt-4">
                  <a
                    href="https://www.google.com/maps/place/Solar+Dom+Pedro/@-30.8919354,-55.4904959,16.52z/data=!4m6!3m5!1s0x950755f4dee359c3:0xfbb9a68896b8c961!8m2!3d-30.8912564!4d-55.4885557!16s%2Fg%2F11bwzyyyyh?entry=ttu&g_ep=EgoyMDI1MDgxMi4wIKXMDSoASAFQAw%3D%3D"
                    className="block font-sans text-sm text-[#6778a8] hover:text-gray-800 transition-colors underline mb-1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {" "}
                    Google Maps
                  </a>
                  <a
                    href="https://www.waze.com/es/live-map/directions/br/rs/solar-dom-pedro?to=place.ChIJw1nj3vRVB5URYcm4loimufs"
                    className="block font-sans text-sm text-[#6778a8] hover:text-gray-800 transition-colors underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {" "}
                    Waze
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-20 md:py-32">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/FotosVir&Jere/rsvp-couple.jpg')",
          }}
        >
          <div className="absolute inset-0 bg-black/30"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <p className="text-white/90 font-sans text-lg md:text-xl tracking-wide mb-6">
            Acompáñanos
          </p>
          <h2 className="text-white font-serif text-3xl md:text-5xl lg:text-6xl font-light leading-tight mb-8">
            ¡Esperamos que puedas acompañarnos!
          </h2>
          <a
            href="https://docs.google.com/forms/u/0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="bg-white text-gray-800 hover:bg-gray-100 font-sans text-sm px-8 py-3">
              Confirmar asistencia
            </Button>
          </a>
        </div>
      </section>

      <section className="flex flex-col md:flex-row gap-0">
        {/* Dress Code Section */}
        <div className="bg-[#c63c71] py-8 md:py-12 flex-1 md:bg-[#596047]">
          <div className="max-w-5xl mx-auto px-6 text-center">
            {/* Dress Code Icon */}
            <div className="my-2">
              <div className="flex justify-center items-center gap-2 text-white text-4xl">
                <img src="/FotosVir&Jere/traje.png" alt="traje" className="w-10 h-10" />
                <img src="/FotosVir&Jere/vestido.png" alt="vestido" className="w-10 h-10" />
              </div>
            </div>
            {/* Dress Code Message */}
            <div className="mb-4">
              <p className="text-[#e9ded0] font-serif text-xl md:text-2xl leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto md:text-[#e9ded0]">
                Vestimenta Formal
              </p>
            </div>
          </div>
        </div>

        {/* Calendar Section */}
        <div className="bg-[#596047] py-8 md:py-12 flex-1">
          <div className="max-w-5xl mx-auto px-6 text-center">
            {/* Calendar icon */}
            <div className="">
              <div className="inline-block text-white text-4xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#e9ded0" }} className="lucide lucide-calendar-heart-icon lucide-calendar-heart"><path d="M12.127 22H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5.125"/><path d="M14.62 18.8A2.25 2.25 0 1 1 18 15.836a2.25 2.25 0 1 1 3.38 2.966l-2.626 2.856a.998.998 0 0 1-1.507 0z"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M8 2v4"/></svg>
              </div>
            </div>
            {/* Calendar Message */}
            <div className="mb-0">
              <p className="text-[#e9ded0] font-serif text-xl md:text-2xl leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto">
                ¡Agendá la fecha en tu calendario!
              </p>
            </div>
            {/* Calendar Button */}
            <a
              href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Boda+Vir+%26+Jere&dates=20260316T200000Z/20260316T230000Z&details=¡Te+esperamos+en+nuestra+boda%21+Confirmá+tu+asistencia+y+agendalo+acá%21"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-[#e9ded0] text-[#596047] mt-4 font-sans text-sm px-10 border/30 hover:bg-gray-100 hover:font-bold">
                AGENDAR EVENTO
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#e9ded0] py-8 md:py-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          {/* Gift icon */}
          <div className="mb-1">
            <div className="inline-block text-white text-4xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#c63c71" }} className="lucide lucide-gift-icon lucide-gift"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>

            </div>
          </div>
          {/* Gift Message */}
          <div className="mb-8">
            <p className="text-[#c63c71] font-serif text-xl md:text-2xl leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto">
              Si estas pensando en hacernos un regalo
            </p>
          </div>

          {/* Gift Button */}
          <div className="space-y-6 mb-2">
            <ul className="space-y-2 text-md text-[#c63c71]">
              <li>
                <strong>Titular de la cuenta:</strong> Virginia Mazzoni
              </li>
              <li>
                <strong>Banco:</strong> Banco Itaú
              </li>
              <li>
                <strong>Tipo:</strong> Caja de Ahorro USD
              </li>
              <li>
                <strong>Nro de Cuenta:</strong>
                <span
                  className="cursor-pointer hover:text-white transition-colors underline ml-1"
                  onClick={copyAccountNumber}
                >
                  {/* TODO FLO: cambiar el numero de cuenta */}
                  2607207
                </span>
              
                  <p className="ml-2 text-sm h-[30px]">
                    {/* todoflo: cambiar el color */}
                   {copied &&  '✓ Copiado!' }
                  </p>
                
              </li>
            </ul>
          </div>
        </div>
      </section>
      <section className="bg-[#596047] py-8 md:py-12">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="text-[#e9ded0] font-serif text-2xl md:text-2xl leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto pb-4 rounded-lg p-4">
            <h3 className="mb-4">Dónde dormir</h3>
            <div className="flex flex-col gap-2 md:flex-row  md:justify-center md:gap-8">
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-r md:pr-8">
                <a
                  href="https://www.smreservas.com/reservas/bodamazzoniberro.asp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Hotel Like Design
                </a>
                <p className="text-[#e9ded0] font-sans text-sm">
                  20% OFF con el código: "BODA"
                </p>
                <p className="text-[#e9ded0] font-sans text-xs">
                  del 9 al 17 de marzo
                </p>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r"></div>
              </div>
              <div className="flex flex-col gap-2 border-[#e9ded0] py-3 md:pt-0">
                <a
                  href="https://www.frontierhotelrivera.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Hotel Frontier Rivera
                </a>
                <a className="text-[#e9ded0] font-sans text-sm hover:underline"
                  href="https://www.google.com/maps/place/frontier+hotel+rivera/data=!4m2!3m1!1s0x95a9fef7d2b46395:0x946e6bc033f6026c?sa=X&ved=1t:242&ictx=111"
                  target="_blank"
                >
                  Ituzaingó 337 esq. Don Pedro de Ceballos, Rivera
                </a>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r mt-4"></div>
              </div>
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-l md:pl-8">
                <a
                  href="https://riveracasinoresort.com/#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Rivera Casino & Resort
                </a>
                <a className="text-[#e9ded0] font-sans text-sm hover:underline"
                  href="https://www.google.com/maps/place/Rivera+Casino+%26+Resort/@-30.8950269,-55.5397599,19.17z/data=!4m9!3m8!1s0x95a9fef77edd27d5:0xc86bba2ef0924437!5m2!4m1!1i2!8m2!3d-30.8952778!4d-55.5388889!16s%2Fg%2F1tfrnj6r?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                >
                  Blv. 33 Orientales 1010, Rivera
                </a>
               
              </div>
            </div>
            {/* TODO FLO: agregar espacio aca arriba  */}
            <div className="h-4 border-b mb-3"></div>
            <h3 className="mb-4 ">Dónde arreglarse</h3>
            <div className="flex flex-col gap-2 md:flex-row  md:justify-center md:gap-8">
              <div className="flex flex-col gap-2 border-[#e9ded0] py-3 md:pt-0">
                <p className="text-[#e9ded0] font-sans text-sm">Gabi Tarabal</p>
                <a href="https://wa.me/5526758956" className="text-[#e9ded0] font-sans text-xs hover:text-white transition-colors">+55 26758956</a>
              </div>
              <div className="flex flex-col gap-2 border-[#e9ded0] py-3 md:pt-0">
                <p className="text-[#e9ded0] font-sans text-sm">Gabi Tarabal</p>
                <a href="https://wa.me/5526758956" className="text-[#e9ded0] font-sans text-xs hover:text-white transition-colors">+55 26758956</a>
              </div>
              <div className="flex flex-col gap-2 border-[#e9ded0] py-3 md:pt-0">
                <p className="text-[#e9ded0] font-sans text-sm">Gabi Tarabal</p>
                <a href="https://wa.me/5526758956" className="text-[#e9ded0] font-sans text-xs hover:text-white transition-colors">+55 26758956</a>
              </div>
            </div>

            <div className="h-4 border-b mb-3"></div>
            <h3 className="mb-4">Dónde comer</h3>
            <div className="flex flex-col gap-2 md:flex-row  md:justify-center md:gap-8">
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-r md:pr-8">
                <a
                  href="https://www.instagram.com/solar.gastronomia.cafe/?hl=es-la"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Solar Dom Pedro
                </a>
                <p className="text-[#e9ded0] font-sans text-sm">
                  10% OFF
                </p>
                {/* TODO FLO: agregar el link de WAZE*/}
                <a 
                  href="https://www.google.com/maps/place/Solar+Dom+Pedro/@-30.8975362,-55.5335914,21z/data=!4m15!1m8!3m7!1s0x95a9fe58dd977c0d:0x71473f431509b3a6!2sAv.+Jo%C3%A3o+Belchior+Goulart,+55+-+Centro,+Sant'Ana+do+Livramento+-+RS,+97574-001,+Brasil!3b1!8m2!3d-30.8974839!4d-55.5335186!16s%2Fg%2F11kb8fd976!3m5!1s0x95a9fe58dd9a2e69:0xa988f692d301b428!8m2!3d-30.8974767!4d-55.533529!16s%2Fg%2F11c1l70011?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D" 
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                    João Goulart, 55, Santana do Livramento
                </a>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r"></div>
              </div>
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-r md:pr-8">
                <a
                  href="https://laperdiz.com.uy/index.php/rivera/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  La Perdiz Rivera
                </a>
                <a 
                  href="https://www.google.com/maps/place/La+Perdiz/@-30.900349,-55.526782,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fe42ae374eb5:0x9802d7ecc8ebf5a1!8m2!3d-30.900349!4d-55.5242071!16s%2Fg%2F11bzq3qr9p?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  Plaza de comidas del shopping Siñeriz
                </a>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r"></div>

              </div>
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-r md:pr-8">
                <a
                  href="https://www.instagram.com/restaurantepampagrill/?hl=es"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Pampa Grill
                </a>
                <a 
                  href="https://www.google.com/maps/place/Pampa+Grill/@-30.8938846,-55.5356063,18.27z/data=!4m6!3m5!1s0x95a9fe57fe62c343:0x36c83a1e3c10eecd!8m2!3d-30.8938307!4d-55.5357572!16s%2Fg%2F11cs5n0fqv?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D "
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  R. Uruguai 1452, Sant'Ana do Livramento
                </a>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r mt-4"></div>
              </div>
              <div className="flex flex-col gap-2 border-[#e9ded0] py-3 md:pt-0">
                <a
                  href="https://www.instagram.com/benedettosteakhouse/?hl=es"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Benedetto
                </a>
                <a 
                  href="https://www.google.com/maps/place/Benedetto+Steakhouse/@-30.8966005,-55.5385088,20.26z/data=!4m6!3m5!1s0x95a9ff983937f6d3:0x8bce4cccdef68b0a!8m2!3d-30.8966172!4d-55.538273!16s%2Fg%2F11k4trl0mt?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  Don Pedro de Ceballos 1070, Rivera
                </a>
              </div>
            </div>
            <div className="h-4 border-b mb-3"></div>
            <h3 className="mb-4"> Mejores Free Shops</h3>
            <div className="flex flex-col gap-2 md:flex-row  md:justify-center md:gap-8">
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-r md:pr-8">
                <a
                  href="https://www.sineriz.com.uy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Siñeriz Shopping
                </a>
                <a 
                  href="https://www.google.com/maps/place/Si%C3%B1eriz+Shopping/@-30.9000187,-55.5251471,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fe42c9ecd189:0xcdab2c3cbd336877!8m2!3d-30.9000187!4d-55.5251471!16s%2Fg%2F12323j9_v?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  João Goulart, 55, Santana do Livramento
                </a>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r"></div>
              </div>
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-r md:pr-8">
                <a
                  href="https://www.dfauy.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  DFA
                </a>
                <a
                  href="https://www.google.com/maps/place/DFA+Rivera/@-30.898677,-55.5414539,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9ff62090edc73:0xf15027bdb4e1c3e6!8m2!3d-30.898677!4d-55.538879!16s%2Fg%2F1tj3m7x4?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  Av. Sarandí 475, Rivera
                </a>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r"></div>

              </div>
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-r md:pr-8">
                <a
                  href="https://www.neutral.com.uy/shops/Rivera"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Neutral
                </a>
                <a
                  href= "https://www.google.com/maps/place/Neutral+Free+Shop/@-30.8981268,-55.5443498,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fef7addf6a79:0x779614173024628!8m2!3d-30.8981269!4d-55.5394789!16s%2Fg%2F1td59t0q?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  Francisco Acuña de Figueroa 1068, Rivera
                </a>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r mt-4"></div>
              </div>
              <div className="flex flex-col gap-2 border-[#e9ded0] py-3 md:pt-0">
                <a
                  href="https://www.baraofreeshop.com.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Barão
                </a>
                <a
                  href="https://www.google.com/maps/place/Bar%C3%A3o+Free+Shop/@-30.8970535,-55.5416008,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fef70f690685:0x1d58df0e3984c2fe!8m2!3d-30.8970535!4d-55.5390259!16s%2Fg%2F1t_h_4t5?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  Paysandú 1071, Rivera
                </a>
              </div>
            </div>
            <div className="h-4 border-b mb-3"></div>
            <h3 className="mb-4"> Conocé Rivera</h3>
            <div className="flex flex-col gap-2 md:flex-row  md:justify-center md:gap-8">
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-r md:pr-8">
                <a
                  href="https://www.google.com/search?q=plaza+internacional+rivera&oq=plaza+interna&gs_lcrp=EgZjaHJvbWUqDwgAEAAYFBiHAhjjAhiABDIPCAAQABgUGIcCGOMCGIAEMhIIARAuGBQYrwEYxwEYhwIYgAQyBwgCEAAYgAQyCQgDEEUYORiABDIHCAQQABiABDIHCAUQABiABDIHCAYQABiABDIHCAcQABiABDIHCAgQABiABDIHCAkQABiABNIBCDE3NDBqMGo3qAIIsAIB8QVBqX2dYhDpmvEFQal9nWIQ6Zo&sourceid=chrome&ie=UTF-8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Plaza Internacional
                </a>
                <a
                  href="https://www.google.com/maps/place/Plaza+Internacional/@-30.8962053,-55.5378717,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9fe587b122a5b:0xa18c901cc947fe5a!8m2!3d-30.8962053!4d-55.5352968!16s%2Fg%2F1td346tz?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  Plaza Internacional
                </a>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r"></div>
              </div>
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-r md:pr-8">
                <a
                  href="https://www.cerrochapeu.com/?srsltid=AfmBOopWjmwLP6Lw_F_3MvxFNh8IAskFe9gmFD6MD89Ka-41Ew4YwszC"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Bodega Cerro Chapeu
                </a>
                <a
                  href="https://www.google.com/maps/place/Bodega+Cerro+Chapeu/@-30.9774647,-55.4481108,17z/data=!3m1!4b1!4m6!3m5!1s0x950757989502e7d9:0x56d72d07b6379c70!8m2!3d-30.9774647!4d-55.4455359!16s%2Fg%2F11c7wc_76p?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  Bodega Cerro Chapeu, Rivera
                </a>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r"></div>
              </div>
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 md:border-r md:pr-8">
                <a
                  href="https://riveracasinoresort.com/#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                  Casino
                </a>
                <a
                  href="https://www.google.com/maps/place/Rivera+Casino+%26+Resort/@-30.8952778,-55.5414638,17z/data=!3m1!4b1!4m9!3m8!1s0x95a9fef77edd27d5:0xc86bba2ef0924437!5m2!4m1!1i2!8m2!3d-30.8952778!4d-55.5388889!16s%2Fg%2F1tfrnj6r?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  Blv. 33 Orientales 1010, Rivera
                </a>
                <div className="border-[#e9ded0] border-b w-[50%] mx-auto md:border-b-0 md:border-r"></div>
              </div>
              <div className="flex flex-col gap-2 pb-3 md:border-b-0 ">
                <a
                  href="https://www.rivera.gub.uy/portal/parque-gran-bretana/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e9ded0] font-serif text-sm md:text-lg leading-relaxed text-center max-w-full sm:max-w-[80ch] mx-auto hover:text-white transition-colors underline"
                >
                 Parque Gran Bretaña
                </a>
                <a
                  href="https://www.google.com/maps/place/Parque+Gran+Breta%C3%B1a/@-30.8701908,-55.6065387,17z/data=!3m1!4b1!4m6!3m5!1s0x95a9f8a0f8bbb983:0x6597b6917cbcc87c!8m2!3d-30.8701908!4d-55.6039638!16s%2Fg%2F11b66bhvdw?entry=ttu&g_ep=EgoyMDI1MDkyNC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  className=" mb-3 text-[#e9ded0] font-sans text-xs hover:text-white transition-colors hover:underline">
                  Parque Gran Bretaña, Rivera
                </a>
                </div>
            </div>
          </div>
        </div>
      </section>


        <footer className="bg-gray-200 py-12 md:py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-1 gap-8 md:gap-12">
              {/* Links Column */}
              <div className="flex flex-col items-center">
                <div className="text-center">
                  <a
                    href="https://docs.google.com/forms/u/0/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      className="bg-[#c63c71] border-white/30 text-[#e9ded0] hover:bg-white/20 backdrop-blur-sm font-sans text-sm px-6"
                    >
                      Confirmar asistencia
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
          {/* TODO FLO: ver footer despues */}
          <div className="max-w-6xl mx-auto px-">
            <div className="text-center text-gray-600 mt-10">
              <p className="text-sm">Hecho con ❤️ por Legup</p>
              <p className="text-xs">Contactate vía florencia@legup.studio</p>
            </div>
          </div>
        </footer>
    </div>
  );
}
