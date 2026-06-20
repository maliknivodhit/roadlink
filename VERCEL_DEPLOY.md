# Deploying to Vercel (via GitHub)

This project is configured to deploy on both Lovable (Cloudflare Workers) and Vercel. When Vercel runs the build, `vite.config.ts` detects the `VERCEL=1` env var and switches the nitro preset to `vercel` automatically.

## 1. Push to GitHub

In Lovable: **+ menu → GitHub → Connect project → Create Repository**.

## 2. Import the repo on Vercel

1. Go to <https://vercel.com/new> and import the GitHub repo.
2. **Framework Preset:** Other (Vercel will use the project's `vite build`).
3. **Build Command:** `bun run build` (or `npm run build`).
4. **Output Directory:** leave blank — nitro's Vercel preset writes to `.vercel/output` and Vercel picks it up automatically.
5. **Install Command:** leave default.

## 3. Environment Variables

Add these in **Vercel → Project Settings → Environment Variables** (Production + Preview):

**Public (client + server):**
- `VITE_SUPABASE_URL` = `https://wwhazukevvetcdrfpmkz.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = (same value as in `.env`)
- `VITE_SUPABASE_PROJECT_ID` = `wwhazukevvetcdrfpmkz`

**Server-only (for server functions):**
- `SUPABASE_URL` = `https://wwhazukevvetcdrfpmkz.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` = (same value)

Optional (only if you call admin features):
- `SUPABASE_SERVICE_ROLE_KEY` (get from your backend dashboard — never commit)

## 4. Supabase Auth: Redirect URLs

In the backend Auth settings, add your Vercel domain(s) to the allowed redirect URLs so Google sign-in works:
- `https://<your-project>.vercel.app`
- `https://<your-project>.vercel.app/*`
- Any custom domain you connect

## 5. Deploy

Push to `main` → Vercel auto-builds and deploys. Subsequent pushes trigger preview deployments per branch.

## Notes

- The `src/server.ts` Cloudflare Workers entry is automatically bypassed on Vercel.
- The `.vercel/` build output should NOT be committed (already ignored by default).
- Lovable preview/publish continues to work unchanged (still uses Cloudflare).
