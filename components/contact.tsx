"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Instagram, Mail, MessageCircle } from "lucide-react"

export function Contact() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-6 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-balance">¿Empezamos tu historia?</h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Contanos sobre tu evento y creemos juntos la invitación perfecta
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="bg-card rounded-3xl p-8 shadow-lg border border-border">
              <form className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Nombre
                  </label>
                  <Input id="name" placeholder="Tu nombre completo" className="rounded-xl" />
                </div>

                <div>
                  <label htmlFor="event" className="block text-sm font-medium mb-2">
                    Tipo de evento
                  </label>
                  <Input id="event" placeholder="Ej: Casamiento, Cumpleaños, Fiesta de 15" className="rounded-xl" />
                </div>

                <div>
                  <label htmlFor="date" className="block text-sm font-medium mb-2">
                    Fecha del evento
                  </label>
                  <Input id="date" type="date" className="rounded-xl" />
                </div>

                <div>
                  <label htmlFor="contact" className="block text-sm font-medium mb-2">
                    Email o WhatsApp
                  </label>
                  <Input id="contact" placeholder="¿Cómo te contactamos?" className="rounded-xl" />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Contanos sobre tu evento
                  </label>
                  <Textarea
                    id="message"
                    placeholder="Compartí tus ideas, estilo, colores favoritos..."
                    rows={4}
                    className="rounded-xl"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full"
                >
                  Enviar solicitud
                </Button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-bold mb-6">Otras formas de contacto</h3>
                <div className="space-y-4">
                  <a
                    href="https://wa.me/59899123456"
                    className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border hover:border-primary transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <MessageCircle className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">WhatsApp</p>
                      <p className="text-sm text-muted-foreground">+598 99 123 456</p>
                    </div>
                  </a>

                  <a
                    href="mailto:hola@invitaciones.uy"
                    className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border hover:border-primary transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">hola@invitaciones.uy</p>
                    </div>
                  </a>

                  <a
                    href="https://instagram.com/invitaciones.uy"
                    className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border hover:border-primary transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Instagram className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Instagram</p>
                      <p className="text-sm text-muted-foreground">@invitaciones.uy</p>
                    </div>
                  </a>
                </div>
              </div>

              <div className="bg-accent/20 rounded-2xl p-6 border border-accent/30">
                <p className="text-sm leading-relaxed">
                  <strong>Tiempo de respuesta:</strong> Respondemos todas las consultas en menos de 24 horas. ¡Estamos
                  ansiosos por conocer tu historia! 💚
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
