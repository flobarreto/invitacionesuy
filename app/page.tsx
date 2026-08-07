"use client"

import { ServicesSection } from "@/components/sections/services-section"
import { ProcessSection } from "@/components/sections/process-section"
import { GuestManagementSection } from "@/components/sections/guest-management-section"
import { HeroSection } from "@/components/sections/hero-section"
import { PortfolioSection } from "@/components/sections/portfolio-section"
import { FAQSection } from "@/components/sections/faq-section"
import { CTASection } from "@/components/sections/cta-section"
import { useRef, useEffect, useState } from "react"

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false)
  const shaderContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkShaderReady = () => {
      if (shaderContainerRef.current) {
        const canvas = shaderContainerRef.current.querySelector("canvas")
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          setIsLoaded(true)
          return true
        }
      }
      return false
    }

    if (checkShaderReady()) return

    const intervalId = setInterval(() => {
      if (checkShaderReady()) {
        clearInterval(intervalId)
      }
    }, 100)

    const fallbackTimer = setTimeout(() => {
      setIsLoaded(true)
    }, 1500)

    return () => {
      clearInterval(intervalId)
      clearTimeout(fallbackTimer)
    }
  }, [])

  return (
    <main className="relative min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-background">

      <div
        className={`relative z-10 transition-opacity duration-700 min-w-0 max-w-full ${isLoaded ? "opacity-100" : "opacity-0"
          }`}
      >
        <HeroSection />
        <GuestManagementSection />
        <ProcessSection />
        <ServicesSection />
        <PortfolioSection />
        <div className="flex w-full h-[20px] bg-[#fefce7]" />
        <FAQSection />
        <CTASection />
      </div>
    </main>
  )
}
