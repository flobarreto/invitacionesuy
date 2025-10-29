import { Heart, Palette, Sparkles } from "lucide-react"

export function About() {
  return (
    <section className="py-24 bg-muted/30 relative overflow-hidden">
      {/* Subtle contour lines background */}
      <div className="absolute inset-0 opacity-5">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="contours" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M10 50 Q 30 30, 50 50 T 90 50" stroke="#30e89b" fill="none" strokeWidth="1" />
              <path d="M10 70 Q 30 50, 50 70 T 90 70" stroke="#30e89b" fill="none" strokeWidth="1" />
              <path d="M10 30 Q 30 10, 50 30 T 90 30" stroke="#30e89b" fill="none" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#contours)" />
        </svg>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-6 mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20">
              <Heart className="w-4 h-4" />
              <span className="text-sm font-medium">Quiénes somos</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-balance">Cada historia merece su propio diseño</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <p className="text-lg leading-relaxed text-muted-foreground">
                En <span className="font-semibold text-foreground">Invitaciones.uy</span> creemos que cada historia
                merece su propio diseño. Creamos invitaciones digitales con alma, donde la tecnología se une con lo
                artesanal.
              </p>

              <p className="text-lg leading-relaxed text-muted-foreground">
                No usamos plantillas. Cada invitación es única, diseñada desde cero para reflejar tu personalidad y el
                espíritu de tu evento.
              </p>

              <div className="flex flex-wrap gap-4 pt-4">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-medium">100% personalizado</span>
                </div>
                <div className="flex items-center gap-2 text-primary">
                  <Palette className="w-5 h-5" />
                  <span className="font-medium">Diseño artesanal</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-3xl overflow-hidden shadow-xl">
                <img
                  src="/creative-team-designing-wedding-invitations-in-mod.jpg"
                  alt="Equipo de Invitaciones.uy"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-accent rounded-full blur-3xl opacity-40" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
