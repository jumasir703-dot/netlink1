# Netlink Billing

ISP billing system for Testy Networks — MikroTik RouterOS hotspot/PPPoE
provisioning driven by M-Pesa Daraja STK Push payments.

## Stack

- Node.js / Express
- PostgreSQL (via `pg`)
- MikroTik RouterOS API (`node-routeros`) — hotspot users + PPPoE secrets
- Safaricom Daraja API — STK Push payments
- JWT — admin dashboard auth
- node-cron — voucher expiry / overdue PPPoE suspension sweep

## How it fits together

```
Customer picks a plan
        │
        ▼
POST /api/mpesa/stkpush  ──►  Daraja sends STK prompt to phone
        │                           │
        │                    customer enters M-Pesa PIN
        │                           │
        ▼                           ▼
payments row (pending)      POST /api/mpesa/callback (Daraja → us)
        │                           │
        └──────────────◄────────────┘
                    │
         billingService.fulfillPayment()
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
 prepaid + hotspot        pppoe (postpaid or prepaid)
 → generate voucher       → create/renew PPPoE secret
 → push hotspot user      → push profile change to router
   to router
```

A cron job (`EXPIRY_CHECK_CRON`, default every 5 min) sweeps:
- expired active vouchers → disconnects + removes the hotspot user from the router
- PPPoE accounts past `next_due_date` → disables the secret + kicks the active session

## Setup

```bash
npm install
cp .env.example .env
# edit .env: DATABASE_URL, MIKROTIK_*, DARAJA_*, JWT_SECRET

npm run migrate   # creates tables
npm run seed       # creates a default admin + example plans (check console output for the password)

npm run dev         # nodemon, local dev
npm start           # production
```

## MikroTik router-side prerequisites

This app doesn't create hotspot/PPP **profiles** (speed tiers) — only
users/secrets against profiles you've already defined in RouterOS. Before
going live, set up in Winbox/CLI:

- `/ip hotspot user profile` — e.g. `hotspot-1hr`, `hotspot-24hr`, `hotspot-7day`
- `/ppp profile` — e.g. `pppoe-5mbps`, `pppoe-10mbps` (with rate-limit set)
- An API user with permissions restricted to what billing needs (`/user add
  group=full` is easiest to start, tighten later)

Then set each plan's `mikrotikProfile` to match the profile name on the
router (see `src/db/seed.js` for the example plans' profile names).

Register your router(s) via `POST /api/routers` (or just rely on the
`MIKROTIK_*` env vars as the default single-router fallback — the code
falls back to those when a customer/voucher has no `router_id`).

## Daraja setup

1. Get sandbox (or production, after Safaricom approval) credentials from
   https://developer.safaricom.co.ke
2. Set `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, `DARAJA_SHORTCODE`,
   `DARAJA_PASSKEY` in `.env`
3. `DARAJA_CALLBACK_URL` must be a **publicly reachable HTTPS URL** —
   Safaricom can't call `localhost`. Use ngrok/a reverse tunnel in dev.

## Key API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | — | Admin login, returns JWT |
| GET | `/api/plans` | — | List active plans (customer-facing) |
| POST | `/api/mpesa/stkpush` | — | Trigger payment prompt for a plan |
| POST | `/api/mpesa/callback` | — | Daraja webhook (not for humans) |
| POST | `/api/vouchers/:code/redeem` | — | Redeem a pre-printed voucher |
| GET | `/api/customers` | JWT | List customers |
| GET | `/api/payments` | JWT | List/audit payments |
| POST | `/api/payments/:id/requery` | JWT | Re-check a stuck pending payment with Daraja |
| POST | `/api/pppoe/:id/suspend` | JWT | Manually suspend a PPPoE customer |
| POST | `/api/routers` | JWT | Register an additional MikroTik router (multi-site) |

## Notes / things to harden before production

- `POST /api/auth/register` is open — lock it behind an existing admin's
  auth (or remove it) once your first admin account exists.
- The Daraja callback handler always returns `200` to Safaricom even on
  internal errors (required, or Safaricom retries aggressively) — internal
  failures are logged and payments that succeeded but failed to provision
  are visible via `GET /api/payments` for manual follow-up.
- No rate-limiting is applied to `/api/vouchers/:code/redeem` beyond the
  global limiter — consider tightening if it's exposed on a public splash
  page (captive portal).
- `PGSSL=true` if your Postgres provider requires SSL (e.g. managed DB).
