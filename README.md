# Certificate Authentication Service

Next.js and Neon/Postgres certificate service with account login, signed certificate issue, verification, search, revocation, public issuer keys, and signed revocation feeds.

## First-run setup

1. Copy `.env.example` to `.env.local` and set `POSTGRES_URL`, `CERT_SECRET`, `CERT_ADMIN_TOKEN`, `AUTH_SECRET`, and a separate `SEED_TOKEN`.
2. Run `pnpm.cmd db:init` to create the database schema, including password-recovery tables.
3. Start the app with `pnpm.cmd dev` (port 4000), then run `pnpm.cmd db:seed` in another terminal to load the sample records.
4. Open `http://localhost:4000/login` and sign in with the seeded demo account: `user@nextmail.com` / `123456`.

The dashboard is certificate-only and requires an administrator account. New accounts created at `/signup` have the citizen role; the seeded demo account is an admin. Signing in as a citizen does not grant certificate-register or issuance access. Certificate issuance and revocation require an admin session or the server-side `CERT_ADMIN_TOKEN`; the browser never needs to receive the admin token. Verification is public and checks both the Ed25519 signature and database status.

Candidates can sign in with their email, phone number, or username. The `/forgot-password` flow sends a time-limited code to the account's registered contact; production email recovery requires the SendGrid settings above. Production SMS delivery is not currently configured, so phone-only accounts should contact support to recover access.

Use `/dashboard/certificates` for the administrator-only certificate register and issue/revoke workflow. Use `/verify` for public token verification and `/issuer` for the standalone issuer form when an administrator is signed in. If a legitimate staff account was created through signup, a database administrator must assign it the `admin` role before it can access certificate management.

`GET /api/.well-known/issuer-keys` publishes the Ed25519 public key and `GET /api/certs/revocation-feed` publishes a signed, short-lived revocation snapshot. For production, replace every placeholder secret with a long random value, use HTTPS, configure the production `AUTH_URL`, and keep `CERT_ADMIN_TOKEN` and `SEED_TOKEN` server-side. Run the seed endpoint only during controlled setup.

Architecture status: the certificate verification product is implemented. The waste-collection domain described later in `CERT_SYSTEM_ARCHITECTURE.md` is not implemented in this repository yet: there are no `/driver`, `/report`, or `/schedule` pages, waste tables, pickup/report APIs, offline queue, route optimization, or camera QR scanner.
