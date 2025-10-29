"use client";

import { CalendarHeart, Clock, MapPin, PartyPopper, Church, Shirt } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useState } from "react";

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

  return (
    <main className="min-h-screen bg-soft-white">
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

          <p className="text-[#827a71]/60 text-xl mb-4 tracking-wide">31 DE ENERO, 2026</p>

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
                <span className="text-lg" >17:00 hs</span>
              </div>
              <div className="flex items-center gap-2 text-[#827a71]/70">
                <a
                  href="https://www.google.com/maps/dir//Mercedes+1769,+11200+Montevideo,+Departamento+de+Montevideo/@-34.9008734,-56.2616841,12z/data=!4m8!4m7!1m0!1m5!1m1!1s0x959f804addaf66db:0xb2a1afe84dea7203!2m2!1d-56.1792823!2d-34.9009023?entry=ttu&g_ep=EgoyMDI1MTAwMS4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="mt-6 bg-[#688268] hover:bg-[#827a71]/90 text-white font-semibold">
                    <MapPin className="w-8 h-8 text-white" />
                    Google Maps
                  </Button>
                </a>
                <a
                  href="https://www.waze.com/es/live-map/directions/uy/departamento-de-montevideo/montevideo/instituto-preuniversitario-juan-xxiii?to=place.ChIJ22av3UqAn5URA3LqTeivobI"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="mt-6 bg-[#827a71] hover:bg-[#688268]/90 text-white font-semibold">
                    <MapPin className="w-8 h-8 text-white" />
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
                  <Button className="mt-6 bg-[#688268] hover:bg-[#827a71]/90 text-white font-semibold">
                    <MapPin className="w-8 h-8 text-white" />
                    Google Maps
                  </Button>
                </a>
                <a
                  href="https://www.waze.com/es/live-map/directions/uy/departamento-de-montevideo/montevideo/haras-los-vagones?to=place.ChIJDfAHR4DRoZURVn4QWiDk_TA"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="mt-6 bg-[#827a71] hover:bg-[#688268]/90 text-white font-semibold">
                    <MapPin className="w-8 h-8 text-white" />
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
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/Picture4.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/Picture5.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/Picture6.jpg"
                alt="Martin y Mica"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/FotosMartin&Mica/Picture7.jpg"
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
{/*  */}
      <section className="px-4 bg-[url('/FotosMartin&Mica/confirmarPresenciaMobile.png')] md:bg-[url('/FotosMartin&Mica/confirmarPresenciaDesktop.png')] bg-cover bg-top bg-no-repeat py-[150px] md:py-20"  >
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-[#827a71] mb-6 text-balance">Confirmá tu presencia</h2>
          <p className="text-xl text-[#827a71]/70 mb-8 leading-relaxed">
            Nos vemos el 31 de enero!
          </p>
          <Button
            size="lg"
            className="bg-transparent border-2 border-[#688268] hover:bg-[#688268]/10 text-[#688268] font-semibold text-lg px-8 py-6 rounded-md w-[250px] mb-2 md:mr-6"
          >
            Confirma presencia aqui
          </Button>
          <a
            href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Boda+Mica+%26+Tincho&dates=20260131T200000Z/20260201T090000Z&details=%C2%A1Guardate+la+fecha+de+nuestro+casamiento+para+que+no+te+olvides+y+puedas+compartir+con+nosotros%21"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 z-0"
          ></a>

          <Button
            size="lg"
            className="border-[#688268] border-2 hover:bg-[#688268]/10 text-[#688268] font-semibold text-lg px-8 py-6 rounded-md bg-transparent w-[250px]"
          >
            Agregalo a tu calendario
          </Button>

        </div>
      </section>


      <footer className="bg-[#827a71]/50 text-soft-white py-12 px-4 pb-15">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-2xl md:text-3xl font-bold mb-4 text-[#827a71]">No tenes como ir?</p>
          <Button
            className="bg-transparent text-[#827a71] font-bold text-lg"
            style={{ textWrap: 'wrap' }}
            onClick={() => window.open('https://chat.whatsapp.com/FiEw3kgzvuLI3LQdHBR4bg', '_blank')}
          >
            Hicimos un grupo de whatsapp para que puedan coordinar transporte, unite aqui!
          </Button>
        </div>
      </footer>

      <footer className="bg-gray-200 py-5 md:py-10">
        <div className="max-w-6xl mx-auto px-">
          <div className="text-center text-gray-600 mt-2">
            <p className="text-sm">Hecho en Uruguay por Legup</p>
            <p className="text-xs">Contactate vía florencia@legup.studio</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
