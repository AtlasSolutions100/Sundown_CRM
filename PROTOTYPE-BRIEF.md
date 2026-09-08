# Sundown Lawn & Irrigation CRM – Prototype Brief

Client: **David Ramsey**, Sundown Lawn & Irrigation (Post Falls / Coeur d'Alene, Idaho – Pacific time)
Source: discovery call with Christian Brown, Sep 1 2026 (transcript in this folder)
Referral: Adam Johnson, Bison Lawn Care (our CRM in progress – used as the design/stack reference)
Onboarding call: Thursday Sep 3, 8 AM Pacific
Prototype: this repo (run with `pnpm install && pnpm dev`, opens on http://localhost:5180)

---

## 1. Who David is and what he wants

- Five years in business, all word of mouth, ~40 properties (many HOAs), wants to scale to 400.
- Four "businesses in one": **Maintenance (mowing/cleanups/pruning/fert), Irrigation (repairs, turn-ons, blowouts), Installs, Backflow testing** (100–200 tests/yr, wants 1,000).
- Background: 10 years process engineering. Talks in Kaizen terms: eliminate non-value-add work, target **85 % billable time**. Currently 50–60 % of his time is computer work.
- Ultimate goal: **back out of operations** and hand the system to an ops manager (his foreman Marcus is the candidate). "How do I train somebody on this? It's all been in my head for five years."
- Tried Yardbook (auto-invoice misses mowings, no completion visibility) and Jobber (crashed). Fell back to paper work-order tickets and phone Notes he re-keys at month end.

## 2. Pain points → what the prototype does

| # | David's words | Prototype feature | Where |
|---|---|---|---|
| 1 | "Give me a completion audit… 3 of 4 applications complete… bring the farthest overdue to the top" | **Completion Audit**: every active contract, per-service milestone bars, done/total, days behind, sorted most-overdue first, schedule straight from the gap | `/contracts` |
| 2 | "What did I not get done?… what money's on the table yet?" | $ remaining on contracts, behind/due counts, weekly "Most behind" list on the dashboard | `/dashboard`, `/contracts` |
| 3 | Text/call/email requests → whiteboard → bid → approve → schedule → invoice | **Service Requests** pipeline board: New → Needs Bid → Bid Sent → Approved → Scheduled → Complete → Invoiced → Paid, with per-ticket timeline | `/tickets` |
| 4 | "Hit a button: job ticket for Camden Place, sprinkler head broken" | **Voice ticket** from the crew app, auto-matches the property from the phrase | `/my/ticket` |
| 5 | Paper work-order ticket: date, property, time in/out, labor, materials; "everything goes in a bucket" | **Work Orders**: tech counts the bucket, picks parts, labor + parts priced automatically, invoice drafted | `/work-orders`, `/my/work-order` |
| 6 | "Mark parts up 50 %… SiteOne is 80 % of my supplies" | **Parts & Pricing** list with cost, markup, sell price; simulated SiteOne price-change review | `/parts` |
| 7 | Auto-invoice he can't trust; has to critique every invoice | **Human-in-the-loop invoicing**: auto-drafted invoices sit in an approval queue; trust meter; flip to auto-send when he's ready. Month-end run button. Reminders + overdue escalation | `/invoices` |
| 8 | 200 handwritten backflow reports/yr (~60 hrs each spring) | **Backflow**: device database per property (make/model/serial/location), purveyor directory, field test entry with live pass/fail, generated report, one email per property to the purveyor | `/backflow`, `/my/backflow` |
| 9 | Routes per day, assign to crews, re-route when an urgent job lands | **Schedule & Routes**: per-crew day view, waiting list by window, dispatch, nearest-neighbour + 2-opt optimizer, Google Maps hand-off, urgent "add & re-route" | `/schedule` |
| 10 | Geofence instead of clocking in on jobs; hours to QuickBooks for payroll | **Time & Geofence**: one clock-in per day, property visits logged by geofence, billable ratio vs 85 % target, QuickBooks sync | `/time` |
| 11 | "Was it 5 % margin? Was it mowing or irrigation?… before I sign a 3–5 year contract" | **Job Costing**: margin by division, by client (worst first, "investigate before renewal" flags), per-client division split, install project breakdown | `/reports` |
| 12 | Trip fee + per-sq-ft rate; adjust one number for fuel, the other for mower cost | **Services & Packages** with equation pricing (`trip fee + rate / 1,000 sqft`), live calculator, packages that auto-renew, contract generation | `/services` |
| 13 | Estimate templates | **Estimates** with templates (T&M repair, full maintenance, paver patio, backflow), print preview, convert to job | `/estimates` |
| 14 | One inbox per client; unknown numbers → "unfiled", assign once and it remembers | **Inbox**: unified text/email/call feed auto-filed by sender; unfiled queue; create lead or request from a message | `/inbox` |
| 15 | Weather: hold when it rains, re-suggest on the first dry day (from Adam's build) | Weather rules in Settings + dashboard suggestion strip | `/settings`, `/dashboard` |
| 16 | Roles for owner / ops manager / foreman / crew; pricing stays private | Role preview switcher, permissions matrix, crew-only mobile app | sidebar, `/team`, `/my/*` |

## 3. How the prototype is built

- Same front-end stack as Bison: React 19, Vite, TypeScript, Tailwind v4, wouter, lucide-react, date-fns. No Radix, no auth, no server.
- All data lives in a seeded in-browser store (`src/data/seed.ts`, persisted to localStorage). "Reset demo" in the sidebar restores the seed. The demo clock is fixed at **Tue Sep 8 2026**.
- Domain model (`src/data/types.ts`) mirrors Bison's schema names where they overlap (clients, services, packages, jobs, invoices, payments, tickets) so porting onto the Bison API/Postgres backend is mechanical. New tables Sundown needs that Bison does not have: `properties` (multi-property HOAs), `contracts` + `contract_lines`, `backflow_devices`, `backflow_tests`, `purveyors`, `parts`, `work_orders`, `messages`, `time_entries` with geofence visits.
- Business logic worth carrying over as-is: `src/lib/pricing.ts` (equation pricing, part markup), `src/lib/metrics.ts` (completion audit, margin attribution from geofence visits, billable split), `src/lib/route.ts` (route optimizer).

## 4. Seeded demo story (for the walkthrough)

- **Behind**: Hayden Creek Village fert Round 4, Sunrise Terrace pruning #1, Riverstone fert Round 3, Prairie Falls backflow test, two missed mowings. The audit surfaces them oldest first.
- **Tickets in every stage**: voice ticket from Tyler at Camden Place (new), Riverstone valve leak (approved → scheduled today on Kyle), Walsh paver patio (bid sent, $8.6k), Lakeside Dental controller (complete, work order submitted, invoice waiting for approval), Hayden Creek limb down (urgent, new).
- **Invoices**: three August auto-invoices plus one work-order invoice waiting for approval; two July invoices overdue with reminders sent; trust meter at 37/100.
- **Backflow**: 22 devices across 12 properties; one failed test at Sunrise Terrace with repair note; Prairie Falls never tested this year.
- **Margins**: Sunrise Terrace (steep slopes, heavy hand-trimming) flags as low margin and "Renewal due" – exactly the case David described.
- **Inbox**: two unfiled messages (a neighbour asking about blowouts, an AP department W-9 request) to show the "file once, remember forever" flow.

## 5. What production needs beyond the prototype

1. Backend + auth: reuse Bison's Express/Postgres/Clerk stack; add the new tables above.
2. Telephony/SMS: one business number (Twilio) with call recording + transcription → inbox + tickets.
3. Email: Gmail API (already built for Bison) for invoices, estimates, purveyor reports.
4. QuickBooks Online: invoices/payments sync and time entries → payroll.
5. Mobile: crew PWA with background geolocation for geofence visits (radius default 120 m).
6. Voice: on-device speech-to-text + property matcher (prototype matcher is in `crew-ticket.tsx`).
7. Weather: NWS/OpenWeather daily check per property (Bison's scheduler pattern).
8. SiteOne pricing: nice-to-have per David; start with CSV import, later scrape/API with his account.
9. Backflow report PDFs per purveyor format (David will send sample reports).
