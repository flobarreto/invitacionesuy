import { Button } from "@/components/ui/button"
import { Heart, Sparkles } from "lucide-react"

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%2330e89b' fillOpacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Text content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Diseño 100% personalizado</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-balance">
              Invitaciones únicas, creadas para contar <span className="text-primary">tu historia</span>
            </h1>

            <p className="text-xl text-muted-foreground leading-relaxed max-w-xl">
              Diseñamos invitaciones digitales a medida, sin plantillas, pensadas especialmente para vos.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8">
                Ver ejemplos
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8 border-2 bg-transparent">
                Solicitar presupuesto
              </Button>
            </div>
          </div>

          {/* Right side - Mockup */}
          <div className="relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-8 backdrop-blur">
              <div className="bg-white rounded-2xl p-8 shadow-xl">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <Heart className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">María & Juan</h3>
                      <p className="text-sm text-muted-foreground">15 de Marzo, 2025</p>
                    </div>
                  </div>

                  <div className="aspect-video bg-gradient-to-br from-accent/30 to-primary/30 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-primary" />
                  </div>

                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded-full w-3/4" />
                    <div className="h-3 bg-muted rounded-full w-1/2" />
                  </div>

                  <Button className="w-full bg-primary hover:bg-primary/90 rounded-full">Confirmar asistencia</Button>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-accent rounded-full blur-2xl opacity-50" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary rounded-full blur-2xl opacity-30" />
          </div>
        </div>
      </div>
    </section>
  )
}
