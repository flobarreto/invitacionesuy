import { MessageCircle, Phone, FileEdit, CheckCircle } from "lucide-react"

const steps = [
  {
    icon: MessageCircle,
    title: "Te contactás con nosotros",
    description: "Completás el formulario o nos escribís por WhatsApp para comenzar.",
    color: "primary",
  },
  {
    icon: Phone,
    title: "Coordinamos una llamada",
    description: "Conocemos tu evento, tu estilo y todas tus ideas para la invitación.",
    color: "secondary",
  },
  {
    icon: FileEdit,
    title: "Primer draft personalizado",
    description: "Te enviamos un diseño inicial para que revises y nos des tu feedback.",
    color: "primary",
  },
  {
    icon: CheckCircle,
    title: "Entrega final",
    description: "Ajustamos los detalles juntos y te entregamos la versión final lista para compartir.",
    color: "secondary",
  },
]

export function Process() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-6 mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-balance">Así es nuestro proceso</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Trabajamos de forma colaborativa para crear la invitación perfecta para tu evento
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isPrimary = step.color === "primary"

              return (
                <div key={index} className="relative">
                  <div className="bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-border h-full">
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
                        isPrimary ? "bg-primary/10" : "bg-secondary/10"
                      }`}
                    >
                      <Icon className={`w-8 h-8 ${isPrimary ? "text-primary" : "text-secondary"}`} />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${isPrimary ? "text-primary" : "text-secondary"}`}>
                          Paso {index + 1}
                        </span>
                      </div>

                      <h3 className="text-xl font-semibold leading-tight">{step.title}</h3>

                      <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>

                  {/* Connecting line */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-border" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
