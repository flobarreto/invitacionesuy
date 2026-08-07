const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BACKGROUND_ASSET_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/

export type FloorPlanBackgroundExtension = "jpg" | "png" | "webp"

export function isCanonicalFloorPlanBackgroundPath(
  eventId: string,
  backgroundPath: string,
) {
  if (!UUID_PATTERN.test(eventId)) return false

  const canonicalEventId = eventId.toLowerCase()
  const separatorIndex = backgroundPath.indexOf("/")
  if (separatorIndex === -1 || backgroundPath.indexOf("/", separatorIndex + 1) !== -1) {
    return false
  }

  const assetName = backgroundPath.slice(separatorIndex + 1)
  const assetMatch = BACKGROUND_ASSET_PATTERN.exec(assetName)
  return (
    backgroundPath.slice(0, separatorIndex) === canonicalEventId &&
    assetMatch?.[0] === assetName
  )
}

export function buildFloorPlanBackgroundPath(
  eventId: string,
  assetId: string,
  extension: FloorPlanBackgroundExtension,
) {
  const backgroundPath = `${eventId.toLowerCase()}/${assetId.toLowerCase()}.${extension}`
  if (!isCanonicalFloorPlanBackgroundPath(eventId, backgroundPath)) {
    throw new TypeError("Invalid floor-plan background path components")
  }
  return backgroundPath
}
