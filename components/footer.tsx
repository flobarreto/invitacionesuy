import { Heart } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-2xl font-bold">Invitaciones.uy</h3>
            <p className="text-secondary-foreground/80 leading-relaxed max-w-md">
              Diseñamos invitaciones digitales con alma, donde la tecnología se une con lo artesanal.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Navegación</h4>
            <ul className="space-y-2 text-secondary-foreground/80">
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Inicio
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Quiénes somos
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Portfolio
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Precios
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contacto</h4>
            <ul className="space-y-2 text-secondary-foreground/80">
              <li>Montevideo, Uruguay</li>
              <li>+598 99 123 456</li>
              <li>hola@invitaciones.uy</li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-secondary-foreground/20 text-center">
          <p className="text-secondary-foreground/80 flex items-center justify-center gap-2 flex-wrap">
            <span>Invitaciones.uy — Hecho con</span>
            <Heart className="w-4 h-4 text-primary fill-primary" />
            <span>en Uruguay</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
