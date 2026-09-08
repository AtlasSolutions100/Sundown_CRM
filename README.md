# Sundown CRM – clickable prototype

Custom CRM prototype for Sundown Lawn & Irrigation (David Ramsey). Front-end only: React 19 + Vite + TypeScript + Tailwind v4, seeded in-browser data (localStorage). No backend, no login.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:5180
pnpm build      # typecheck + production build to dist/
```

## Demo tips

- The demo clock is fixed at **Tuesday, Sep 8 2026** so the seeded season (Apr–Nov) reads correctly.
- Sidebar → **Preview as** switches Owner / Ops Manager / Foreman / Crew. Crew opens the phone-framed field app (`/my/day`).
- Sidebar → **Reset demo** restores the original seed after you have clicked around.
- Every action is real against the local store: approving an invoice, dispatching a job, filing an inbox message, recording a backflow test all update the other pages.

## Layout

```
src/
  data/types.ts     domain model (aligned with Bison CRM schema names)
  data/seed.ts      deterministic demo data (14 clients, ~450 jobs, tickets, invoices, geofence visits)
  data/store.tsx    React context store + business actions (approveInvoice, submitWorkOrder, ...)
  lib/pricing.ts    trip fee + per-1,000 sqft equation pricing, part markup
  lib/metrics.ts    completion audit, margin attribution, billable split, balances
  lib/route.ts      nearest-neighbour + 2-opt route optimizer, Google Maps link
  components/ui.tsx small shadcn-style kit (no Radix)
  components/layout admin sidebar shell + crew phone shell
  pages/            one file per screen; crew-*.tsx are the mobile screens
```

See `PROTOTYPE-BRIEF.md` for the transcript → feature mapping and the production plan.
