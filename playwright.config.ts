import { defineConfig, devices } from "@playwright/test";
const remoteBaseURL = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL: remoteBaseURL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [{ name: "mobile-chromium" }],
  webServer: remoteBaseURL
    ? undefined
    : {
        command: "npm run start",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
