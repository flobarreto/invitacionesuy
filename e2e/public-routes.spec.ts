import { expect, test } from "@playwright/test"
import { getInvitationDefinitions } from "../lib/invitations/registry"

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// The scaffold registers a preset in the same typed registry. Deriving the
// matrix here means every newly published invitation automatically needs both
// mobile and desktop approval; no second test list can silently go stale.
const invitations = getInvitationDefinitions().map((definition) => ({
  slug: definition.slug,
  title: new RegExp(escapeRegExp(definition.metadata.title), "i"),
}))

test.beforeEach(async ({ page }) => {
  await page.addInitScript({
    content: `
      (() => {
        const fixedTime = new Date("2026-08-05T15:00:00-03:00").valueOf();
        const NativeDate = Date;
        class FixedDate extends NativeDate {
          constructor(...args) {
            super(...(args.length === 0 ? [fixedTime] : args));
          }
          static now() { return fixedTime; }
        }
        Object.defineProperty(globalThis, "Date", {
          configurable: true,
          value: FixedDate,
        });
        Math.random = () => 0.3141592653589793;
      })();
    `,
  })
})

async function waitForVisualAssets(page: import("@playwright/test").Page) {
  const brokenVisibleImages = await page.evaluate(async () => {
    const withTimeout = <T,>(promise: Promise<T>, milliseconds = 8_000) =>
      Promise.race<T | undefined>([
        promise,
        new Promise<undefined>((resolve) => window.setTimeout(resolve, milliseconds)),
      ])

    await withTimeout(document.fonts.ready)
    const visibleImages = Array.from(document.images).filter((image) => {
      const bounds = image.getBoundingClientRect()
      // Next/Image may leave zero-sized lazy images mounted outside the active
      // slide. They are not part of the screenshot and will intentionally not
      // start loading, so waiting for them would never settle.
      return bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight
    })
    await Promise.all(
      visibleImages.map(async (image) => {
        if (!image.complete) {
          await withTimeout(new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true })
            image.addEventListener("error", () => resolve(), { once: true })
          }))
        }
        if (image.decode && image.complete) {
          await withTimeout(image.decode().catch(() => undefined))
        }
      }),
    )
    return visibleImages
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src)
  })

  expect(brokenVisibleImages).toEqual([])
}

async function expectHealthyDocument(page: import("@playwright/test").Page) {
  await expect(page.locator("body")).toBeVisible()
  await expect(page.locator("body")).not.toContainText("Application error")
  await expect(page.locator("body")).not.toContainText("Internal Server Error")

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

  await waitForVisualAssets(page)
}

test("la portada pública carga sin servicios externos", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" })

  expect(response?.status()).toBe(200)
  await expect(page.locator("main")).toBeVisible()
  await expectHealthyDocument(page)
})

test("un alias legacy conserva el token al redirigir", async ({ page }) => {
  const token = "token-de-prueba-123456789012345678901234567890"
  const response = await page.goto(
    `/bodaMica&Santi?token=${encodeURIComponent(token)}`,
    { waitUntil: "domcontentloaded" },
  )

  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL(
    new RegExp(`/invitaciones/mica-santi\\?token=${token}$`),
  )
})

for (const invitation of invitations) {
  test(`regresión visual: ${invitation.slug}`, async ({ page }) => {
    const response = await page.goto(`/invitaciones/${invitation.slug}`, {
      waitUntil: "load",
    })

    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(invitation.title)
    await expect(page.locator("main").first()).toBeVisible()
    await expectHealthyDocument(page)
    await expect(page).toHaveScreenshot(`invitation-${invitation.slug}.png`, {
      fullPage: false,
    })
  })
}
