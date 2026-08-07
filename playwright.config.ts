import { defineConfig } from "@playwright/test"

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "3100", 10)
const host = "127.0.0.1"
const baseURL = `http://${host}:${port}`
const runProductionBuild = process.env.PLAYWRIGHT_USE_BUILD === "true"

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  // Baselines are shared across local macOS generation and Linux CI. Exact local
  // WOFF files plus a small rasterization tolerance keep this meaningful without
  // maintaining one copy per operating system.
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  // Next dev compiles each legacy renderer on demand. Serial visual capture
  // avoids concurrent compiler refreshes destroying a page execution context
  // while its fonts and images are being stabilized.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "es-UY",
    timezoneId: "America/Montevideo",
    colorScheme: "light",
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
      scale: "css",
      stylePath: "./e2e/visual-regression.css",
      threshold: 0.35,
    },
  },
  projects: [
    {
      name: "mobile-390",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "desktop-1440",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: runProductionBuild
      ? `npm run start -- --hostname ${host} --port ${port}`
      : `npm run dev -- --hostname ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      APP_URL: baseURL,
      ENABLE_STATIC_INVITATION_EVENT_ADAPTER: "true",
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_TELEMETRY_DISABLED: "1",
      WHATSAPP_GLOBAL_ENABLED: "false",
    },
  },
})
