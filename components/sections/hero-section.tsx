"use client"

export function HeroSection() {
  return (
    <section
      data-section
      className="flex min-h-screen flex-col justify-center px-6 pb-16 pt-12 md:px-12 md:pb-24 font-umeko"
      style={{
        backgroundImage: "url('/landing/background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="bg-[#fefce7] w-full h-full text-[#4d3022]">
        <div className="p-6">
          <h1 className="mb-6 animate-in fade-in slide-in-from-bottom-8 font-sans text-6xl font-light leading-[1.1] tracking-tight duration-1000 md:text-7xl lg:text-8xl">
            <span className=" font-umeko">
              Una invitación
              <br />
              tan única como tu evento
            </span>
          </h1>

          <p className="mb-8 animate-in fade-in slide-in-from-bottom-4 text-lg leading-relaxed  duration-1000 delay-200 md:text-xl">
            <span className="text-pretty ">
              Invitaciones web personalizadas que combinan estética y tecnología.

              <br />
              <span className="">
                Control total de confirmaciones, mesas y organización en un solo lugar.
              </span>
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
