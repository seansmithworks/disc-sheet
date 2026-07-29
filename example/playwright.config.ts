import { defineConfig } from "@playwright/test";

/**
 * geometry.spec.ts and a11y.spec.ts run against the Vite dev server for the
 * example app — real rendered geometry and real ARIA state, not a JSDOM
 * approximation. See docs/PACKAGE-DESIGN.md and REVIEW-FINDINGS.md
 * ("WHAT THE GATES ARE NOT MEASURING" — tsc/vitest cannot see any of the
 * package's actual defects, all of which are CSS and rendered geometry).
 */
export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4873",
  },
  webServer: {
    // vite.config.ts lives inside example/ with root: "./example" (so its
    // own root resolves relative to itself); "example" as the CLI root
    // argument is what the npm "dev"/"build" scripts already rely on, run
    // from the package root, one level up from this config file.
    // --host 127.0.0.1: Vite's default bind is IPv6 loopback ([::1]) only,
    // which a plain IPv4 http://127.0.0.1 client (Playwright's default,
    // curl, etc.) cannot reach — force IPv4 explicitly.
    command:
      "node_modules/.bin/vite example --port 4873 --strictPort --host 127.0.0.1",
    cwd: "..",
    url: "http://127.0.0.1:4873",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
