import { defineConfig } from "vitest/config";

// Every test in spec/ runs against the running app, which spec/global-setup.ts
// finds. Only spec/ runs: a test anywhere else needs adding to `include`.
export default defineConfig({
  test: {
    include: ["spec/**/*.test.ts"],
    // Some specs start a private copy of the app, or two, and a busy CI machine can
    // take several seconds over that alone. A slow machine should not be a failure.
    testTimeout: 45_000,
    hookTimeout: 45_000,
    globalSetup: ["./spec/global-setup.ts"],
  },
});
