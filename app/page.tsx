"use client"

import type React from "react"
import { Button } from "@/components/ui/button"

// Reusable Badge Component
function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="px-[14px] py-[6px] bg-white shadow-[0px_0px_0px_4px_rgba(55,50,47,0.05)] overflow-hidden rounded-[90px] flex justify-start items-center gap-[8px] border border-[rgba(2,6,23,0.08)] shadow-xs">
      <div className="w-[14px] h-[14px] relative overflow-hidden flex items-center justify-center">{icon}</div>
      <div className="text-center flex justify-center flex-col text-[#37322F] text-xs font-medium leading-3 font-sans">
        {text}
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div className="w-full min-h-screen relative bg-[#F7F5F3] overflow-x-hidden flex flex-col justify-start items-center">
      <div className="relative flex flex-col justify-start items-center w-full">
        {/* Main container with proper margins */}
        <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-0 lg:max-w-[1060px] lg:w-[1060px] relative flex flex-col justify-start items-start min-h-screen">
          {/* Left vertical line */}
          <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-[rgba(55,50,47,0.12)] shadow-[1px_0px_0px_white] z-0"></div>

          {/* Right vertical line */}
          <div className="w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-[rgba(55,50,47,0.12)] shadow-[1px_0px_0px_white] z-0"></div>

          <div className="self-stretch pt-[9px] overflow-hidden border-b border-[rgba(55,50,47,0.06)] flex flex-col justify-center items-center gap-4 sm:gap-6 md:gap-8 lg:gap-[66px] relative z-10">


            {/* Hero Section */}
            <div className="pt-16 sm:pt-20 md:pt-24 lg:pt-[216px] pb-8 sm:pb-12 md:pb-16 flex flex-col justify-start items-center px-2 sm:px-4 md:px-8 lg:px-0 w-full">
              <div className="w-full max-w-[937px] lg:w-[937px] flex flex-col justify-center items-center gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                <div className="self-stretch rounded-[3px] flex flex-col justify-center items-center gap-4 sm:gap-5 md:gap-6 lg:gap-8">
                  <div className="w-full max-w-[748.71px] lg:w-[748.71px] text-center flex justify-center flex-col text-[#37322F] text-[24px] xs:text-[28px] sm:text-[36px] md:text-[52px] lg:text-[80px] font-normal leading-[1.1] sm:leading-[1.15] md:leading-[1.2] lg:leading-24 font-serif px-2 sm:px-4 md:px-0">
                    Tu evento merece
                    <br />
                    algo único
                  </div>
                  <div className="w-full max-w-[506.08px] lg:w-[506.08px] text-center flex justify-center flex-col text-[rgba(55,50,47,0.80)] sm:text-lg md:text-xl leading-[1.4] sm:leading-[1.45] md:leading-[1.5] lg:leading-7 font-sans px-2 sm:px-4 md:px-0 lg:text-lg font-medium text-sm">
                    Diseñamos páginas web personalizadas para que tu historia, tu estilo
                    <br className="hidden sm:block" />
                    y cada detalle de tu día especial se sienta propio.
                    <br className="hidden sm:block" />
                    Sin plantillas. Sin repetir diseños. Solo algo hecho para vos.
                  </div>
                </div>
              </div>

              <div className="w-full max-w-[497px] lg:w-[497px] flex flex-col justify-center items-center gap-6 sm:gap-8 md:gap-10 lg:gap-12 relative z-10 mt-6 sm:mt-8 md:mt-10 lg:mt-12">
                <div className="backdrop-blur-[8.25px] flex justify-start items-center gap-4">
                  <a
                    href="https://wa.link/tff00g"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 sm:h-11 md:h-12 px-6 sm:px-8 md:px-10 lg:px-12 py-2 sm:py-[6px] relative bg-[#37322F] shadow-[0px_0px_0px_2.5px_rgba(255,255,255,0.08)_inset] overflow-hidden rounded-full flex justify-center items-center"
                  >
                    <div className="w-20 sm:w-24 md:w-28 lg:w-44 h-[41px] absolute left-0 top-[-0.5px] bg-gradient-to-b from-[rgba(255,255,255,0)] to-[rgba(0,0,0,0.10)] mix-blend-multiply"></div>
                    <div className="flex flex-col justify-center text-white text-sm sm:text-base md:text-[15px] font-medium leading-5 font-sans">
                      Hablemos por WhatsApp
                    </div>
                  </a>
                </div>
              </div>

              <div className="absolute top-[232px] sm:top-[248px] md:top-[264px] lg:top-[320px] left-1/2 transform -translate-x-1/2 z-0 pointer-events-none">
                <img
                  src="/mask-group-pattern.svg"
                  alt=""
                  className="w-[936px] sm:w-[1404px] md:w-[2106px] lg:w-[2808px] h-auto opacity-30 sm:opacity-40 md:opacity-50 mix-blend-multiply"
                  style={{
                    filter: "hue-rotate(15deg) saturate(0.7) brightness(1.2)",
                  }}
                />
              </div>
            </div>

            {/* About Service Section */}
            <div className="w-full border-b border-[rgba(55,50,47,0.12)] flex flex-col justify-center items-center py-12 sm:py-16 md:py-20 lg:py-24">
              <div className="w-full max-w-[700px] px-4 sm:px-6 py-4 sm:py-5 flex flex-col justify-start items-center gap-6 sm:gap-8">
                <Badge
                  icon={
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 1L9 5L13 5.5L10 8.5L10.5 13L7 11L3.5 13L4 8.5L1 5.5L5 5L7 1Z" stroke="#37322F" strokeWidth="1" fill="none"/>
                    </svg>
                  }
                  text="Sobre el servicio"
                />
                <div className="self-stretch text-center text-[#37322F] text-base sm:text-lg md:text-xl leading-relaxed font-sans">
                  Cada evento tiene una esencia propia. Un tono, una energía, una historia que merece ser contada con amor y con intención.
                  <br /><br />
                  Por eso, diseño páginas web que nacen desde cero, pensadas especialmente para vos. No hay dos iguales: cada una refleja la estética, emoción y personalidad de quienes celebran.
                  <br /><br />
                  Incluye una base de datos para gestionar RSVP, preferencias y todo lo que necesitás para organizar con calma y sin estrés.
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="w-full border-b border-[rgba(55,50,47,0.12)] flex flex-col justify-center items-center">
              <div className="self-stretch px-4 sm:px-6 md:px-8 py-12 sm:py-16 border-b border-[rgba(55,50,47,0.12)] flex justify-center items-center">
                <div className="w-full max-w-[616px] flex flex-col justify-start items-center gap-4">
                  <Badge
                    icon={
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="2" width="10" height="10" stroke="#37322F" strokeWidth="1" fill="none" />
                        <line x1="2" y1="5" x2="12" y2="5" stroke="#37322F" strokeWidth="1"/>
                      </svg>
                    }
                    text="Servicios y precios"
                  />
                  <div className="w-full text-center text-[#49423D] text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight font-sans tracking-tight">
                    Elige el plan perfecto para tu evento
                  </div>
                </div>
              </div>

              <div className="self-stretch flex justify-center items-start">
                <div className="w-4 sm:w-6 md:w-8 lg:w-12 self-stretch relative overflow-hidden">
                  <div className="w-[120px] sm:w-[140px] md:w-[162px] left-[-40px] sm:left-[-50px] md:left-[-58px] top-[-120px] absolute flex flex-col justify-start items-start">
                    {Array.from({ length: 100 }).map((_, i) => (
                      <div
                        key={i}
                        className="self-stretch h-3 sm:h-4 rotate-[-45deg] origin-top-left outline outline-[0.5px] outline-[rgba(3,7,18,0.08)] outline-offset-[-0.25px]"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 border-l border-r border-[rgba(55,50,47,0.12)]">
                  {/* Plan 1 - Identidad + Web */}
                  <div className="border-b border-r-0 md:border-r border-[rgba(55,50,47,0.12)] p-6 sm:p-8 lg:p-12 flex flex-col justify-between items-start gap-6 bg-white">
                    <div className="flex flex-col gap-4 w-full">
                      <div className="text-[#37322F] text-sm font-semibold uppercase tracking-wide">Servicio 1</div>
                      <h3 className="text-[#37322F] text-2xl sm:text-3xl font-semibold leading-tight font-sans">
                        Identidad Visual + Página Web
                      </h3>
                      <div className="text-[#37322F] text-4xl sm:text-5xl font-bold font-sans">
                        USD 200
                      </div>
                      <p className="text-[#605A57] text-base leading-relaxed font-sans">
                        Si querés que tu evento tenga una estética coherente y mágica desde principio a fin. 
                      </p>
                      <div className="flex flex-col gap-3 mt-4">
                        <div className="text-[#37322F] text-sm font-semibold">Incluye:</div>
                        <ul className="flex flex-col gap-2 text-[#605A57] text-sm leading-relaxed">
                          <li className="flex items-start gap-2">
                            <span className="text-[#37322F] mt-1">•</span>
                            <span>Identidad visual creada especialmente para tu evento</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#37322F] mt-1">•</span>
                            <span>Paleta, tipografías, moodboard y estilo gráfico</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#37322F] mt-1">•</span>
                            <span>Diseño + desarrollo de la web</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#37322F] mt-1">•</span>
                            <span>Carga inicial del contenido</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#37322F] mt-1">•</span>
                            <span>Optimización full responsive</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#37322F] mt-1">•</span>
                            <span>Base de datos de invitados</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Plan 2 - Solo Web */}
                  <div className="border-b border-[rgba(55,50,47,0.12)] p-6 sm:p-8 lg:p-12 flex flex-col justify-between items-start gap-6">
                    <div className="flex flex-col gap-4 w-full">
                      <div className="text-[#37322F] text-sm font-semibold uppercase tracking-wide">Servicio 2</div>
                      <h3 className="text-[#37322F] text-2xl sm:text-3xl font-semibold leading-tight font-sans">
                        Solo Página Web Personalizada
                      </h3>
                      <div className="text-[#37322F] text-4xl sm:text-5xl font-bold font-sans">
                        USD 100
                      </div>
                      <p className="text-[#605A57] text-base leading-relaxed font-sans">
                        Para quienes ya tienen estética elegida, pero quieren una web especial.
                      </p>
                      <div className="flex flex-col gap-3 mt-4">
                        <div className="text-[#37322F] text-sm font-semibold">Incluye:</div>
                        <ul className="flex flex-col gap-2 text-[#605A57] text-sm leading-relaxed">
                          <li className="flex items-start gap-2">
                            <span className="text-[#37322F] mt-1">•</span>
                            <span>Diseño único creado desde cero</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#37322F] mt-1">•</span>
                            <span>Desarrollo completo</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#37322F] mt-1">•</span>
                            <span>Link para compartir con tus invitados</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#37322F] mt-1">•</span>
                            <span>Panel opcional para gestionar invitados</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-4 sm:w-6 md:w-8 lg:w-12 self-stretch relative overflow-hidden">
                  <div className="w-[120px] sm:w-[140px] md:w-[162px] left-[-40px] sm:left-[-50px] md:left-[-58px] top-[-120px] absolute flex flex-col justify-start items-start">
                    {Array.from({ length: 100 }).map((_, i) => (
                      <div
                        key={i}
                        className="self-stretch h-3 sm:h-4 rotate-[-45deg] origin-top-left outline outline-[0.5px] outline-[rgba(3,7,18,0.08)] outline-offset-[-0.25px]"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* CTA Button after pricing */}
              <div className="w-full flex justify-center py-8 sm:py-12 border-t border-[rgba(55,50,47,0.12)]">
                <a
                  href="https://wa.link/tff00g"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 sm:h-11 md:h-12 px-8 sm:px-10 md:px-12 py-2 bg-[#37322F] hover:bg-[#37322F]/90 shadow-[0px_0px_0px_2.5px_rgba(255,255,255,0.08)_inset] overflow-hidden rounded-full flex justify-center items-center transition-colors"
                >
                  <span className="text-white text-sm sm:text-base font-medium font-sans">
                    Consultar por WhatsApp
                  </span>
                </a>
              </div>
            </div>

            {/* Process Section */}
            <div className="w-full border-b border-[rgba(55,50,47,0.12)] flex flex-col justify-center items-center py-12 sm:py-16 md:py-20 lg:py-24">
              <div className="w-full max-w-[800px] px-4 sm:px-6 flex flex-col items-center gap-8 sm:gap-12">
                <div className="flex flex-col items-center gap-4">
                  <Badge
                    icon={
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="3" cy="7" r="2" stroke="#37322F" strokeWidth="1" fill="none"/>
                        <circle cx="7" cy="7" r="2" stroke="#37322F" strokeWidth="1" fill="none"/>
                        <circle cx="11" cy="7" r="2" stroke="#37322F" strokeWidth="1" fill="none"/>
                      </svg>
                    }
                    text="Proceso"
                  />
                  <h2 className="text-center text-[#49423D] text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight font-sans tracking-tight">
                    Paso a paso
                  </h2>
                </div>

                <div className="w-full flex flex-col gap-6 sm:gap-8">
                  {[
                    {
                      number: "01",
                      title: "Nos escribís",
                      description: "Nos contás sobre tu evento y lo que imaginás."
                    },
                    {
                      number: "02",
                      title: "Hablamos",
                      description: "Nos conocemos y definimos juntas el estilo, la vibra y los detalles."
                    },
                    {
                      number: "03",
                      title: "Diseño + desarrollo",
                      description: "Creamos tu página como si fuera para nosotros: cuidando cada detalle, cada color y cada palabra."
                    },
                    {
                      number: "04",
                      title: "Entrega",
                      description: "Te la entregamos lista para compartir y emocionar a tus invitados."
                    },
                    {
                      number: "05",
                      title: "Ajustes",
                      description: "Si hay algo que querés cambiar, lo hacemos hasta que quede exactamente como lo soñaste."
                    }
                  ].map((step, index) => (
                    <div key={index} className="flex gap-4 sm:gap-6 items-start">
                      <div className="text-[#37322F]/20 text-4xl sm:text-5xl font-bold font-sans flex-shrink-0">
                        {step.number}
                      </div>
                      <div className="flex flex-col gap-2 pt-1">
                        <h3 className="text-[#37322F] text-xl sm:text-2xl font-semibold font-sans">
                          {step.title}
                        </h3>
                        <p className="text-[#605A57] text-base leading-relaxed font-sans">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Visual Identity Section */}
            <div className="w-full border-b border-[rgba(55,50,47,0.12)] flex flex-col justify-center items-center py-12 sm:py-16 md:py-20 lg:py-24 bg-white">
              <div className="w-full max-w-[700px] px-4 sm:px-6 flex flex-col items-center gap-6 sm:gap-8">
                <h2 className="text-center text-[#49423D] text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight font-sans tracking-tight">
                  ¿Querés que todo tu evento tenga una estética coherente?
                </h2>
                <div className="self-stretch text-center text-[#605A57] text-base sm:text-lg leading-relaxed font-sans">
                  Puedo crear la identidad visual completa:
                </div>
                <ul className="flex flex-col gap-3 text-[#605A57] text-base leading-relaxed w-full max-w-[500px]">
                  <li className="flex items-center gap-3">
                    <span className="text-[#37322F] text-xl">•</span>
                    <span>Paleta personalizada</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#37322F] text-xl">•</span>
                    <span>Moodboard</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#37322F] text-xl">•</span>
                    <span>Logo / monograma</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#37322F] text-xl">•</span>
                    <span>Gráfica para invitaciones</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#37322F] text-xl">•</span>
                    <span>Números de mesa y menús personalizados</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#37322F] text-xl">•</span>
                    <span>Estilo para redes y proveedores</span>
                  </li>
                </ul>
                <p className="text-center text-[#37322F] text-lg font-medium leading-relaxed font-sans mt-4">
                  Una estética que te represente y transforme tu evento en una experiencia.
                </p>
              </div>
            </div>

            {/* Guest Management Section */}
            <div className="w-full border-b border-[rgba(55,50,47,0.12)] flex flex-col justify-center items-center py-12 sm:py-16 md:py-20 lg:py-24">
              <div className="w-full max-w-[700px] px-4 sm:px-6 flex flex-col items-center gap-6 sm:gap-8">
                <h2 className="text-center text-[#49423D] text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight font-sans tracking-tight">
                  Gestión de invitados
                </h2>
                <div className="self-stretch text-center text-[#605A57] text-base sm:text-lg leading-relaxed font-sans">
                  Organizar un evento puede ser un caos.
                  <br />
                  Por eso, tu página incluye una base de datos donde podés:
                </div>
                <ul className="flex flex-col gap-3 text-[#605A57] text-base leading-relaxed w-full max-w-[500px]">
                  <li className="flex items-center gap-3">
                    <span className="text-[#37322F] text-xl">•</span>
                    <span>Ver quién confirmó</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#37322F] text-xl">•</span>
                    <span>Registrar preferencias</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#37322F] text-xl">•</span>
                    <span>Organizar listas</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#37322F] text-xl">•</span>
                    <span>Exportar datos</span>
                  </li>
                </ul>
                <p className="text-center text-[#37322F] text-lg font-medium leading-relaxed font-sans mt-4">
                  Es tu propio centro de organización.
                </p>
              </div>
            </div>

            {/* Final CTA Section */}
            <div className="w-full flex flex-col justify-center items-center py-16 sm:py-20 md:py-24 lg:py-32">
              <div className="w-full max-w-[700px] px-4 sm:px-6 flex flex-col items-center gap-8 sm:gap-10">
                <h2 className="text-center text-[#49423D] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight font-sans tracking-tight">
                  ¿Querés una web que realmente hable de vos y de tu evento?
                </h2>
                <a
                  href="https://wa.link/tff00g"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-12 sm:h-14 px-12 sm:px-16 py-3 bg-[#37322F] hover:bg-[#37322F]/90 shadow-[0px_0px_0px_2.5px_rgba(255,255,255,0.08)_inset] overflow-hidden rounded-full flex justify-center items-center transition-colors"
                >
                  <span className="text-white text-base sm:text-lg font-medium font-sans">
                    Hablar por WhatsApp
                  </span>
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="w-full border-t border-[rgba(55,50,47,0.12)] py-8 flex justify-center">
              <div className="text-center text-[#605A57] text-sm font-sans">
                Invitaciones.uy - Diseño de páginas web para eventos.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}