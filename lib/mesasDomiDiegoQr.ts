import QRCode from "qrcode"
import { opaqueInvitationTokenSchema } from "@/lib/seating/public-table-contract"

export function mesasDomiDiegoSiteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://invitia.uy")
  )
}

export function mesasDomiDiegoQrTarget(tokenInput: string): string {
  const token = opaqueInvitationTokenSchema.parse(tokenInput)
  const target = new URL("/mesas-domi-diego", mesasDomiDiegoSiteOrigin())
  target.searchParams.set("token", token)
  return target.toString()
}

export async function mesasDomiDiegoQrSvg(token: string): Promise<{
  target: string
  svg: string
}> {
  const target = mesasDomiDiegoQrTarget(token)
  const svg = await QRCode.toString(target, {
    type: "svg",
    margin: 2,
    width: 320,
    color: { dark: "#3c4439", light: "#fcf5ed" },
  })
  return { target, svg }
}
