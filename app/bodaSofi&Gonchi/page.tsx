"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import { RadioGroup, RadioGroupItem } from "@radix-ui/react-radio-group";
import { Separator } from "@radix-ui/react-separator";
import { CalendarIcon, SendIcon, MapPinIcon } from "lucide-react"
import Image from "next/image"

const eventSections = [
  {
    id: "ceremony",
    icon: "/bodaSofi&Gonchi/church.png",
    iconHeight: "h-[100px]",
    title: "Ceremonia",
    location: "Parroquia San Juan Bautista\nMonseñor Domingo Tamburini 1210",
    time: "19:30",
    timeLabel: "Puntual",
    hasButton: true,
    googleURL: 'www.google.com',
    wazeURL: "www.waze.com"
  },
  {
    id: "party",
    icon: "/bodaSofi&Gonchi/party.png",
    iconHeight: "h-[100px]",
    title: "Fiesta",
    location: "Quinta de Arteaga \n Ruta 5, Km 12.500",
    time: "Post",
    timeLabel: "Ceremonia",
    hasButton: true,
    googleURL: 'www.google.com',
    wazeURL: "www.waze.com"
  },
  {
    id: "gift",
    icon: "/bodaSofi&Gonchi/gift.png",
    iconHeight: "h-[100px]",
    title: "Regalos",
    giftInformation: {
      name: "Sofia Symonds",
      bank: "Itau",
      accountNumber: "4203797",
      accountType: "Caja de ahorro USD"
    }
  },
];

const attendanceOptions = [
  { value: "yes", label: "Sí, allí estaré" },
  { value: "no", label: "No, lo siento" },
];

const dietaryOptions = [
  { value: "none", label: "Sin Restricción" },
  { value: "vegetarian", label: "Vegetariano" },
  { value: "celiac", label: "Celíaco" },
];

export default function BodaSofiGonchi() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })

  useEffect(() => {
    const targetDate = new Date('2025-12-20T19:30:00').getTime()

    const updateCountdown = () => {
      const now = new Date().getTime()
      const difference = targetDate - now

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24))
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))

        setTimeLeft({ days, hours, minutes })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 })
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Actualizar cada minuto

    return () => clearInterval(interval)
  }, [])

  return (
    <main className="source-sans-3-font h-[100vh] w-[100vw]">
      <section
        className="relative h-full bg-[#F9F7EB] py-[40px] px-[8px] flex flex-col justify-between"
      >
        <div
          className="absolute bottom-0 left-0 w-full rounded-[166px_166px_0px_0px]"
          style={{
            background: `radial-gradient(81.64% 81.64% at 50% 81.64%, rgba(249, 247, 235, 0.00) 70%, #F9F7EB 100%), linear-gradient(180deg, rgba(83, 44, 10, 0.00) 0%, rgba(83, 44, 10, 0.00) 75.48%, #532C0A 100%), url(https://c.animaapp.com/mhwmlgcmJBg8gd/img/image-1.png) lightgray`,
            backgroundSize: 'cover',
            backgroundPosition: '50%',
            backgroundRepeat: 'no-repeat',
            backgroundBlendMode: 'normal, normal, multiply',
            height: '70%'
          }}>

        </div>

        <div className="text-[#095F7E] font-light flex flex-col items-center justify-center relative z-10">
          <p >¡NOS CASAMOS!</p>
          <p className="font-boska text-[#9E500B] text-[56px]">Sofi &amp; Gonchi</p>
          <p> 20 . DICIEMBRE . 2025</p>
        </div>

        <div className="flex flex-col items-center relative z-10">
          <Button className="h-8 gap-2 mb-[16px] pl-3 pr-4 py-0 bg-[#0c4256] hover:bg-[#0c4256] rounded-[100px] transition-colors">
            <CalendarIcon className="w-5 h-5" />
            <span className=" font-light text-[#f9f7eb] text-base text-center tracking-[0] leading-[normal] whitespace-nowrap">
              Agendar
            </span>
          </Button>
          <div className="font-boska text-[#532C0A] text-[28px] inline-flex flex-col items-center gap-3 relative rounded-[1000px] bg-[rgba(249,247,235,0.75)] py-[12px] px-[32px]">
            {timeLeft.days} d . {String(timeLeft.hours).padStart(2, '0')} h . {String(timeLeft.minutes).padStart(2, '0')} m
          </div>
        </div>
      </section>
      
      <section className="bg-[#532C0A] min-h-[400px] text-[#F9F7EB] flex flex-col items-center justify-center">
        {eventSections.map((section) => <div className="flex flex-col items-center justify-center" key={section.id}>
          <div>
            <img
              className={`relative object-contain ${section.iconHeight} w-auto`}
              alt={`${section.title} icon`}
              src={section.icon}
            />
          </div>

          {section.giftInformation ? <div>
            BANK
          </div> :
            <>
              <div className="flex flex-col items-center justify-center text-center font-light max-w-[80%]">
                <p className="font-boska-medium text-[28px]">{section.title}</p>
                <p>{section.location}</p>
                <Button className="rounded-[100px] bg-[rgba(249,247,235,0.20)] font-light">
                  <MapPinIcon className="w-5 h-5" strokeWidth={1}/>
                  ¿Cómo ir?
                </Button>
              </div>
              <div>
              <p className="font-boska-medium text-[28px]">{section.time}</p>
              <p className="font-light text-[16px]">{section.timeLabel}</p>
              </div>
            </>}



        </div>)}

        

      </section>
    </main>                                                                                                                                                                                 
  )
};
