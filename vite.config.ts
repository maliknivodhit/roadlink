// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vercel sets VERCEL=1 during builds. When deploying to Vercel we switch the
// nitro preset to "vercel" and skip the Cloudflare Workers SSR entry wrapper.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  ...(isVercel
    ? { nitro: { preset: "vercel" } }
    : {
        tanstackStart: {
          // Redirect TanStack Start's bundled server entry to src/server.ts
          // (our Cloudflare Workers SSR error wrapper). Skipped on Vercel.
          server: { entry: "server" },
        },
      }),
});
