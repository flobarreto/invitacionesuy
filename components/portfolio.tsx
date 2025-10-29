import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

const examples = [
  {
    title: "Casamiento María & Juan",
    category: "Boda elegante",
    image: "/elegant-wedding-invitation-design-with-floral-elem.jpg",
  },
  {
    title: "Fiesta de 15 Sofía",
    category: "Quinceañera moderna",
    image: "/modern-quincea-era-invitation-with-gold-accents.jpg",
  },
  {
    title: "Casamiento Ana & Pedro",
    category: "Boda minimalista",
    image: "/minimalist-wedding-invitation-with-geometric-shape.jpg",
  },
  {
    title: "Aniversario Laura & Carlos",
    category: "Celebración íntima",
    image: "/intimate-anniversary-invitation-with-romantic-desi.jpg",
  },
  {
    title: "Casamiento Lucía & Martín",
    category: "Boda campestre",
    image: "/rustic-countryside-wedding-invitation-with-nature-.jpg",
  },
  {
    title: "Fiesta Corporativa",
    category: "Evento empresarial",
    image: "/elegant-corporate-event-invitation-design.jpg",
  },
]

export function Portfolio() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-balance">Algunos de nuestros diseños</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Cada invitación cuenta una historia única
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {examples.map((example, index) => (
            <div
              key={index}
              className="group relative bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300"
            >
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src={example.image || "/placeholder.svg"}
                  alt={example.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="p-6 space-y-2">
                <p className="text-sm text-primary font-medium">{example.category}</p>
                <h3 className="text-xl font-semibold">{example.title}</h3>
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-8">
                <Button variant="secondary" className="bg-white text-secondary hover:bg-white/90 rounded-full">
                  Ver detalles
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8">
            Quiero mi invitación personalizada
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  )
}
