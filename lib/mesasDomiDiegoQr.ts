import QRCode from "qrcode"

export function mesasDomiDiegoSiteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://invitia.uy")
  )
}

export async function mesasDomiDiegoQrSvg(): Promise<{
  target: string
  svg: string
}> {
  const target = `${mesasDomiDiegoSiteOrigin()}/mesas-domi-diego`
  const svg = await QRCode.toString(target, {
    type: "svg",
    margin: 2,
    width: 320,
    color: { dark: "#3c4439", light: "#fcf5ed" },
  })
  return { target, svg }
}
