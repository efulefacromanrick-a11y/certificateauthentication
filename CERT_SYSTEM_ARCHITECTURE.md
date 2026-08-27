# QR Certificate Verification — System Architecture

Status: Draft — designed to integrate with the existing Next.js app at the repository root.

Goals
- Enable issuance of signed digital certificates and verification via QR codes.
- Verification must be secure, fast, auditable, and user-friendly (both issuer admin UI and public scanner).
- Support revocation, key rotation, offline/online verification, and strong telemetry.

Implementation details: revocation, key rotation, offline verification, telemetry
--------------------------------------------------------------------------------
This section provides concrete implementation patterns, small code snippets, and SQL to support:
- Revocation feeds (online + offline)
- Key rotation with overlapping validity
- Offline verification (revocation bloom + signed snapshot)
- Structured telemetry and Prometheus metrics

1) Revocation feed & DB support
- Keep the canonical `certificates` table as defined. Add a lightweight `revocations` table to record feed entries:

```sql
CREATE TABLE revocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id UUID NOT NULL,
  serial TEXT NULL,
  revoked_at timestamptz NOT NULL,
  reason text NULL,
  created_by UUID NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_revocations_certificate_id ON revocations(certificate_id);
CREATE INDEX idx_revocations_created_at ON revocations(created_at);
```

- Publish a signed revocation snapshot endpoint: `GET /api/certs/revocation-feed` that returns JSON:

```json
{ "issued_at": 1690000000, "revoked": ["<serial1>", "<serial2>"] }
```

- The endpoint must sign this JSON with the issuer private key (JWS) so clients can verify authenticity without contacting the DB.

2) Revocation Bloom filter (offline fast-check)
- Generate a Bloom filter from the current set of revoked serials and publish as a base64 blob at `/api/certs/revocation-bloom` with metadata (hash, version, ttl).
- Example Node snippet using `bloom-filters` package:

```js
import { BloomFilter } from 'bloom-filters';
import { signBlob } from './kms-wrapper';

async function publishBloom(revokedSerials) {
  const filter = BloomFilter.from(revokedSerials, 0.01); // 1% fp rate
  const blob = Buffer.from(JSON.stringify(filter.save())).toString('base64');
  const signed = await signBlob(blob); // KMS sign
  return { blob, signed, created_at: Date.now() };
}
```

- Offline verifier algorithm (summary):
  1. Verify JWS signature with published public key(s).
  2. Extract `serial` or `id` from payload.
  3. Download and verify `revocation-bloom` signature if available (cache it).
  4. If `serial` is in Bloom -> show "May be revoked — verify online" CTA.
  5. If not in Bloom -> show "Likely valid (offline)" but show last-sync timestamp.

3) Key rotation & public key publication
- Use KMS to create keys. Maintain an `issuer_keys` metadata table or publish via `.well-known/issuer-keys`.

Example `issuer-keys` response (signed by a rotation authority):
```json
{
  "keys":[
    {"kid":"issuer-key-v2","alg":"EdDSA","pub":"<base64-pub>","valid_from":1690000000,"valid_to":1710000000},
    {"kid":"issuer-key-v1","alg":"EdDSA","pub":"<base64-pub>","valid_from":1670000000,"valid_to":1690000000}
  ],
  "issued_at":1690200000
}
```

- Rotation procedure (operational checklist):
  1. Generate new key in KMS (or import) and store its `kid`.
  2. Publish the new public key in `.well-known/issuer-keys` with `valid_from` now and `valid_to` in future; keep previous key with overlapping window for verification.
  3. Update signing service to use new key for subsequent issuances.
  4. Monitor verification logs for unexpected increases in failures.
  5. After old key `valid_to`, remove it from the published set.

4) Online verification endpoint details
- `POST /api/certs/verify` should:
  - Accept compact JWS or raw `id` + signature.
  - Validate JWS header `kid` and `alg`, fetch/verify public key from cache.
  - If signature is valid: query DB for certificate record and status.
  - Return JSON with canonical `status` and a short `message` and `confidence` (e.g., `high` for online verified, `medium` for offline-bloom check).

5) Telemetry, logs, and metrics (structured)
- Events to log (structured JSON):
  - cert.issued { id, serial, issuer, created_by, ip }
  - cert.revoked { id, serial, reason, revoked_by, ip }
  - cert.verify { id?, serial?, jws_kid, result, reason?, ip, ua, latency_ms, verifier: 'online'|'offline' }
  - keys.rotated { old_kid, new_kid, rotated_by }

- Prometheus metrics (suggested):
  - `certs_issued_total`
  - `certs_revoked_total`
  - `certs_verify_requests_total{status}`
  - `certs_verify_latency_seconds` (histogram)
  - `certs_verify_invalid_signature_total`
  - `certs_revocation_bloom_fp_rate` (gauge - observed)

- Example structured log (JSON):
```json
{"ts":1690001234,"event":"cert.verify","id":"...","serial":"...","result":"invalid","reason":"sig_mismatch","ip":"x.x.x.x","ua":"...","latency_ms":23}
```

6) Operational notes and caching
- Cache public keys and revocation blobs in CDN with TTL (e.g., 5–60 minutes) and use ETag/If-None-Match to allow clients to revalidate cheaply.
- For the verification API, use Redis or in-memory LRU caches for recent revocation checks and recent JWS `jti` (if you support nonces) to avoid repeated DB load.

7) Security hardening bits
- Protect `/api/certs/issue` and `/api/certs/revoke` behind NextAuth roles and/or mTLS/service tokens for automated integrators.
- Ensure revocation-feed endpoint is signed and includes `issued_at` and `expires_at` to avoid stale offline caches.

End of expanded implementation details.

High-level components
- Issuer Admin UI (protected): create certificates, view audit logs, revoke certificates, manage keys (delegated to KMS).
- Certificate Store (DB): persistent records with revocation state and metadata.
- Signing Service (server-side): signs certificate payloads using a private key stored in KMS/HSM.
- QR Generator (frontend/server): encodes signed payload into QR (compact form).
- Verification API (public): validates signed payload, checks revocation and expiration, returns canonical verification result.
- Scanner UI (public web/mobile): scans QR, queries Verification API (or verifies offline with public key), shows clear status with human-friendly messaging.
- Key Management: use KMS (AWS KMS, Azure Key Vault, Google KMS) for private keys and rotation.
- Observability: audit logs, request logging, metrics, alerting for suspicious patterns.

Data model (Postgres)
- Table: certificates
  - id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
  - serial TEXT UNIQUE NOT NULL -- short, human-friendly identifier
  - holder_name TEXT NOT NULL
  - holder_email TEXT
  - type TEXT NOT NULL
  - issued_at TIMESTAMP WITH TIME ZONE NOT NULL
  - expires_at TIMESTAMP WITH TIME ZONE NULL
  - metadata JSONB -- arbitrary additional data
  - signature TEXT NOT NULL -- compact JWS or base64 signature
  - status TEXT NOT NULL DEFAULT 'active' -- enum: active, revoked
  - revoked_at TIMESTAMP WITH TIME ZONE NULL
  - revoked_reason TEXT NULL
  - created_by UUID NULL -- admin user id
  - created_at TIMESTAMP WITH TIME ZONE DEFAULT now()

Indexes
- idx_certificates_serial (unique)
- idx_certificates_status
- idx_certificates_issued_at

QR payload format (compact & forward-compatible)
- Use a compact JWS (JSON Web Signature) or COSE message.
- Payload (JSON) fields (v1):
  - v: '1'              -- version
  - id: '<uuid>'       -- certificate id (matches DB)
  - s: '<alg>'         -- signing algorithm id (e.g., EdDSA)
  - iat: <unix_ts>     -- issued at
  - exp: <unix_ts>?    -- optional expiry
  - p: '<b64url>'      -- optional compressed metadata (if any)

- The QR contains the JWS compact serialization: <header>.<payload>.<signature>
- This keeps size small and makes verification interoperable. Prefer Ed25519 (EdDSA) for smaller signatures and simple verification.

Signing and verification
- Signing (server-side):
  1. Build the canonical payload from certificate fields.
  2. Use KMS/HSM to sign (or use a detached JWS with the server applying the signature).
  3. Store `signature` in DB and emit QR with compact JWS.

- Verification (server or client):
  1. Parse JWS; validate header and version.
  2. Verify signature with the issuer public key (public keys are published via an endpoint: `/api/.well-known/issuer-keys` and cached).
  3. Extract `id` and check DB for `status`, `expires_at`, and other constraints.
  4. Return one of: Valid, Expired, Revoked, InvalidSignature, Malformed.

Offline verification support
- Publish issuer public key(s) and a short-lived “revocation snapshot” (revocation Bloom filter or signed denylist) to allow offline clients to check revocation without querying server.
- For high assurance, require online check for revocation; for low-assurance quick checks allow offline verification and show a caution banner.

Revocation strategies
- Primary: mark DB `status = revoked` and set `revoked_at`.
- Secondary: publish signed revocation lists (e.g., signed JSON with serials + timestamp), and a Bloom filter for quick membership tests.
- Support per-cert short-lived tokens or short expiry to limit exposure.

API endpoints (Next.js app router under `app/api/certs`)
- POST /api/certs/issue (protected)
  - Auth: Admin (NextAuth or service token + role check)
  - Body: { holder_name, holder_email?, type, expires_at?, metadata? }
  - Returns: { id, serial, jws } and saved DB record.

- POST /api/certs/revoke (protected)
  - Auth: Admin
  - Body: { id, reason }
  - Action: set status, revoked_at, persist audit log; optionally publish to revocation feed.

- POST /api/certs/verify (public)
  - Body: { jws } OR accept `jws` as query param
  - Rate-limit by IP and client token
  - Validation steps: parse, verify signature, check DB status, check expiry
  - Response (200): { status: 'valid'|'expired'|'revoked'|'invalid', id, holder_name, type, issued_at, expires_at, metadata }

- GET /api/.well-known/issuer-keys
  - Publish rotating public keys + metadata (kid, alg, valid_from, valid_to) signed by issuer.

Security controls and best practices
- Key management
  - Store private keys only in KMS/HSM. Never store raw private keys in env or code.
  - Use small number of signing keys with canonical `kid` in JWS headers.
  - Implement automatic key rotation with overlapping validity windows.

- Transport & web
  - Enforce HTTPS/TLS everywhere. Use HSTS, secure cookies, CSP, and appropriate CORS.
  - Hardening: rate-limiting (especially `/api/certs/verify`), IP blacklists, request throttling.

- API & validation
  - Validate all inputs with `zod` or equivalent. Use typed schemas for request/response.
  - Use prepared statements / parameterized queries (the `postgres` client supports tagged templates already but ensure no dynamic SQL concatenation).
  - Return minimal error messages to public API (avoid leaking internal details).

- Signature verification
  - Use constant-time verification where applicable.
  - Check `kid` in JWS header and fetch correct public key; cache keys locally with TTL.

- Logging & auditing
  - Log issuance, revocation, verification attempts (without persisting full PII in logs unless required and protected).
  - Store audit trails in append-only store (DB table or external SIEM).
  - Record source IP, user-agent, admin user id for sensitive actions.

- Rate limiting & abuse
  - Verify endpoint: aggressive per-IP rate limits; optional per-client API key for high-volume scanners.
  - Implement CAPTCHA or human challenge when suspicious patterns detected.

- Monitoring & alerts
  - Track verification error rate, signature verification failures, unusually large revocation spikes, and repeated expired checks.
  - Alert on repeated invalid signatures or sudden change in verification volume.

Edge cases & how to handle them
- Clock skew: accept small skew (e.g., +/- 5 minutes) and display clear 'time-based' warning.
- Replay: QR contains id+iat and optionally nonce; if attacker replays a valid but non-revoked certificate, it's allowed — treat revocation and expiry as controls.
- Tampered QR: signature verification fails -> return `invalid` and display clear guidance.
- Key compromise: rotate keys immediately, publish new `issuer-keys`, mark potentially affected certificates for re-issuance and publish revocation feed.
- Offline checks: allow offline verification with caveats and encourage online verification for high-assurance checks.

UX / Frontend
- Issuer Admin UI (protected):
  - Stepper to create certificate (name, type, metadata, expiry)
  - Preview certificate and QR (SVG + downloadable PNG)
  - Button to copy share link and download PDF with QR
  - Searchable audit log and revocation list with filters

- Public Scanner UI (mobile-first):
  - Camera access with permission prompt, fallback to file upload of QR image
  - Large status card with color-coded result: Green (Valid), Yellow (Expired / Caution), Red (Revoked / Invalid)
  - Show certificate summary and a 'Verify Online' button if offline
  - Accessibility: high-contrast mode, screen-reader friendly, clear copy for next steps

Prototype implementation plan (priority)
1. Add DB migrations: certificates table + indexes.
2. Implement server utility: `signCertificate(payload)` and `verifyJWS(jws)` using a KMS-backed signing wrapper.
3. Implement protected `POST /api/certs/issue` and `POST /api/certs/revoke` with zod validation.
4. Implement public `POST /api/certs/verify` and `.well-known/issuer-keys`.
5. Create admin React pages/components for issuing and revoking (reuse existing ui/button.tsx, login form and NextAuth setup).
6. Create scanner UI page that uses the camera and decodes QR → calls verify API.

Testing and QA
- Unit tests for signing and verification logic (include malformed JWS, expired, revoked cases).
- Integration tests for API endpoints using a test DB, seeded data, and mocked KMS.
- E2E test for scanner flow (simulate camera input or use QR image fixtures).

Deployment & operations
- Secrets: store KMS key identifiers, not raw keys, in environment variables.
- Staging: mirror production with its own KMS keys and a short TTL revocation feed.
- Rollout: implement feature flags and gradual rollout for verification endpoints.

Appendix — Example SQL migration (Postgres)
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serial TEXT UNIQUE NOT NULL,
  holder_name TEXT NOT NULL,
  holder_email TEXT NULL,
  type TEXT NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NULL,
  metadata jsonb NULL,
  signature text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  revoked_at timestamptz NULL,
  revoked_reason text NULL,
  created_by UUID NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_certificates_serial ON certificates(serial);
CREATE INDEX idx_certificates_status ON certificates(status);
```

Appendix — Minimal JWS header example
```json
{"alg":"EdDSA","kid":"issuer-key-v1","typ":"JWT"}
```

Next steps
- I can implement the first milestone (DB migration + signing + verify API endpoints and admin issue UI) in this repository. Would you like me to:
  1) scaffold the API endpoints and DB migration files now, or
  2) produce a more detailed sequence of code-level tasks and sample code snippets for each endpoint?

-------------------------------------------------------------------------------
Integrated Waste Collection Management System (using this Next.js app)
-------------------------------------------------------------------------------

Overview (simple)
- Think of the system like three helpers working together:
  1. The Office (Admin Dashboard) — plans routes, sees pickups, pays bills.
  2. The Driver (Mobile PWA) — gets route, marks bins collected, works offline.
  3. The Citizen (Web Portal) — reports overflowing bins, sees schedule, gets alerts.

How this repo maps to the system
- Use the existing Next.js app for the Office and Citizen portals under `app/` (pages: `/admin`, `/report`, `/schedule`).
- Add a PWA `driver` client (mobile-first) that reuses the same components and `app/api` backend.
- Reuse `app/lib` for shared utilities (geo, qrcode, postgres access).

Core components
- Backend (Next.js API + Postgres):
  - `users`, `roles` (admin, dispatcher, driver, citizen)
  - `bins` (id, location, type, last_collected, status)
  - `vehicles` and `drivers` (capacity, assigned route)
  - `routes` and `route_stops` (ordered list of bin ids, estimated time)
  - `pickups` (bin_id, route_id, status: pending|collected|missed, timestamp, collected_by)
  - `reports` (citizen reports: overflowing, illegal dumping)
  - `alerts` (notifications for citizens and ops)

- Frontend:
  - `Admin Dashboard` (`/admin`): route planner, map view, live status, analytics.
  - `Driver PWA` (`/driver`): route list, map + turn-by-turn, offline queue, photo capture.
  - `Citizen Portal` (`/report`, `/schedule`): view next pickup days, report bin problems.

APIs (examples)
- `GET /api/bins?bbox=...` — list bins in view (for maps)
- `POST /api/pickups/complete` — driver marks pickup done (accepts offline queue sync)
- `POST /api/reports` — citizen reports a problem (photo optional)
- `GET /api/routes/today` — driver's route for the day
- `POST /api/route/optimize` — (admin) request optimized route recalculation

Offline-first driver flow
- Driver app downloads the day's route and assets (map tiles cached by browser, images) and works offline.
- Each action (pickup complete, photo) is queued locally with a monotonic local id and retried until sync.
- Server endpoints accept idempotent requests (use client-generated `client_event_id`) so duplicates are harmless.

Edge cases and mitigations
- Missed pickup due to obstruction: driver marks `missed` with photo; system auto-schedules retry and notifies citizen.
- Wrong bin scanned: allow driver to re-scan and attach notes; admin can reassign pickup.
- Offline conflict when two drivers claim same bin: server resolves by first-write wins, stores audit log, notifies dispatcher.
- GPS drift: accept fuzzy matches (within 50m) and require photo if GPS is far from bin location.
- Battery / connectivity loss: local queue persisted in IndexedDB; small media uploads deferred to Wi-Fi.
- Fraud (false pickups): require optional photo proof and periodic audits; flag abnormal patterns (many fast pickups).

Security
- Auth: use NextAuth for admin and citizen; issue short-lived driver tokens for PWA with refresh.
- Roles & scopes: restrict create/modify routes to dispatchers; pickups restricted to drivers.
- Data privacy: photos stored in protected blob storage with signed URLs; PII minimised in logs.

UI/UX guidelines (child-simple)
- Big buttons: "Start my route", "Scan bin", "Report problem".
- Color cues: Green = done, Yellow = warning, Red = problem.
- One-task screens: show only the next bin and a big "Collected" button.
- Use clear dates: "Next pickup: Tuesday, 8 AM" not timestamps.

Testing & QA
- Unit tests for route optimization and pickup reconciliation logic.
- Integration tests: driver offline sync, report pipeline, and admin route edit flows.

Deployment notes
- Host Next.js on Vercel or any Node host; Postgres on managed provider.
- Use background workers (e.g., serverless functions or a small worker pool) for heavy tasks: route optimization, analytics, image processing.

Next steps (practical)
1. Create DB migration scripts for `bins`, `routes`, `pickups`, `reports`, `vehicles`, `drivers`.
2. Add TypeScript types in `app/lib/definitions.ts` for waste domain.
3. Scaffold API endpoints under `app/api/waste/*` and driver PWA pages under `app/driver`.
4. Implement offline queue helper (IndexedDB wrapper) and idempotent server handlers.

If you want, I can scaffold the DB migrations and the first API routes now using your repo as a template.
