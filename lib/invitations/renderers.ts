import type { ComponentType } from "react"
import type {
  InvitationDefinition,
  InvitationRendererId,
} from "./types"

export type InvitationRendererModule = {
  default: ComponentType<{ definition: InvitationDefinition }>
}

type InvitationRendererLoader = (
  definition: InvitationDefinition,
) => Promise<InvitationRendererModule>

export const invitationRenderers: Record<
  InvitationRendererId,
  InvitationRendererLoader
> = {
  "legacy-andres-lucre": () => import("@/app/bodaAndres&Lucre/page"),
  "legacy-calas": () => import("@/app/bodaCalas/page"),
  "legacy-domi-diego": (definition) =>
    definition.variant === "hotel"
      ? import("@/app/bodaDomi&Diego-hotel/page")
      : import("@/app/bodaDomi&Diego/page"),
  "legacy-mica-santi": () => import("@/app/bodaMica&Santi/page"),
  "legacy-mica-tincho": () => import("@/app/bodaMica&Tincho/page"),
  "legacy-sofi-gonchi": () => import("@/app/bodaSofi&Gonchi/page"),
  "legacy-vir-jere": () => import("@/app/bodaVir&Jere/page"),
  "preset-editorial": () =>
    import("@/components/invitations/presets/editorial"),
}
