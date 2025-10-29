import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Invitación Simple",
    description: "Perfecta para eventos íntimos",
    features: [
      "Una pantalla de diseño",
      "Información del evento",
      "Confirmación de asistencia",
      "Diseño personalizado",
      "Entrega en 7 días",
    ],
  },
  {
    name: "Invitación Animada",
    description: "Dale vida a tu invitación",
    features: [
      "Todo lo de Simple",
      "Animaciones suaves",
      "Música de fondo",
      "Múltiples secciones",
      "Galería de fotos",
      "Entrega en 10 días",
    ],
    featured: true,
  },
  {
    name: "Invitación Premium",
    description: "La experiencia completa",
    features: [
      "Todo lo de Animada",
      "Ilustraciones personalizadas",
      "Interacciones avanzadas",
      "Mapa interactivo",
      "Contador regresivo",
      "Soporte prioritario",
      "Entrega en 14 días",
    ],
  },
]

export function Pricing() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-balance">Transparencia desde el primer clic</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Cada invitación se diseña a medida, pero te mostramos nuestras referencias para que puedas elegir con
            claridad
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-card rounded-3xl p-8 shadow-lg hover:shadow-xl transition-all ${
                plan.featured ? "border-2 border-primary scale-105" : "border border-border"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  Más popular
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground">{plan.description}</p>
                </div>

                <ul className="space-y-4">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.featured ? "bg-primary" : "bg-primary/20"
                        }`}
                      >
                        <Check className={`w-3 h-3 ${plan.featured ? "text-white" : "text-primary"}`} />
                      </div>
                      <span className="text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full rounded-full ${
                    plan.featured
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  }`}
                  size="lg"
                >
                  Solicitar presupuesto
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
