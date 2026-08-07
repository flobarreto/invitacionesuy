import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Invitación Simple",
    description: "Perfecta para eventos íntimos",
    featured: false,
    features: [
      "Una pantalla de diseño",
      "Información del evento",
      "Confirmación de asistencia",
      "Diseño personalizado",
      "Entrega en 7 días",
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

        <div className="flex gap-8 max-w-6xl mx-auto items-center justify-center">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-card rounded-3xl p-8 shadow-lg hover:shadow-xl transition-all`}
            >

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
