import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

//Unit tests. Files that end in `.test.ts` run in Node. Files that end in `.test.tsx` run
//in jsdom, with the matchers of Testing Library. The tests make no calls to the API.
const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          setupFiles: ["tests/setup.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
          setupFiles: ["tests/setup.ts", "tests/setup.dom.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      //The pages and layouts in `app` are async server components. The live parity check
      //(`npm run parity:live`) tests them against the API, so they are not in this list.
      include: [
        "utils/**/*.ts",
        "components/**/*.{ts,tsx}",
        "app/api/**/*.ts",
        "app/robots.ts",
        "proxy.ts",
        "parity/**/*.mjs",
        "scripts/**/*.mjs",
      ],
      //`scripts/parity.mjs` is the command-line part of the parity check. Its logic is in
      //`scripts/parity-lib.mjs`. A test runs it as a separate process, which v8 cannot measure.
      exclude: ["components/sections/ListSection/index.ts", "scripts/parity.mjs"],
      //The CI job and the pre-commit hook fail when the coverage is less than these values
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
