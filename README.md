# streampay-backend

**StreamPay** API backend — stream management, usage metering, and settlement services.

## Overview

Node.js + Express (TypeScript) service that will power the StreamPay API gateway: health checks, stream listing, and (later) metering and Stellar settlement integration.

## Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)

## Setup for contributors

1. **Clone and enter the repo**
   ```bash
   git clone <repo-url>
   cd streampay-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Verify setup**
   ```bash
   npm run build
   npm test
   ```

4. **Run locally**
   ```bash
   npm run dev    # dev with hot reload
   # or
   npm run build && npm start
   ```

API will be at `http://localhost:3001` (or `PORT` env). Try `GET /health` and `GET /api/streams`.

## API Key Authentication (Service-to-Service and Webhooks)

The backend supports API key authentication for internal jobs and partner integrations, distinct from user JWT flows.

- Header: `x-api-key` or `Authorization: ApiKey <key>`
- Keys are hashed with SHA-256 at rest
- Constant-time comparison via `crypto.timingSafeEqual`
- Revoked keys are rejected and treated as invalid

Set environment variable(s) before starting:

- `API_KEYS`: comma-separated plaintext keys (development/test only)
- `API_KEY_HASHES`: comma-separated SHA256 hashes (production / at-rest hashes)

Add `x-api-key` to `/api/v1/*` and `/webhooks/indexer` requests.

## Indexer webhook ingestion

The backend now exposes `POST /webhooks/indexer` for trusted chain-indexer events such as `stream_created` and `settled`.

Set `INDEXER_WEBHOOK_SECRET` before running the service. The sender must compute an HMAC SHA-256 signature over the raw JSON request body and send it in the `x-indexer-signature` header using either the raw hex digest or the `sha256=<digest>` format.

Example payload:

```json
{
  "eventId": "evt_123",
  "eventType": "stream_created",
  "streamId": "stream_456",
  "occurredAt": "2026-03-23T10:00:00.000Z",
  "chainId": "stellar-testnet",
  "transactionHash": "abc123",
  "data": {
    "amount": "42"
  }
}
```

Security notes:

- Signature verification uses the raw request body and `crypto.timingSafeEqual`.
- Replay protection is enforced by deduplicating `eventId` values in the ingestion service.
- Duplicate deliveries are treated as safe no-ops and return `202 Accepted`.

## Soft Delete / Retention policy

A new soft delete flow is available for stream records:

- `DELETE /api/v1/streams/:id`: marks the record as soft-deleted via `deleted_at` timestamp.
- `GET /api/v1/streams`: by default returns non-deleted records; add `?includeDeleted=true` for admin/inspection mode.
- `GET /api/v1/streams/:id`: by default hides soft-deleted records; add `?includeDeleted=true` to retrieve them.

All queries now include `deleted_at IS NULL` unless `includeDeleted` is explicitly true.

## API Versioning Policy

All new features and endpoints must be mounted under the `/api/v1` prefix.

**Deprecation and Sunset Policy:**
We use HTTP headers to signal end-of-life for specific API versions:
- `X-API-Version`: Indicates the current version of the API responding to the request.
- `Deprecation`: A boolean flag (`true` or `false`) indicating if the API version is deprecated. When `true`, developers should migrate to a newer version as soon as possible.

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run build`| Compile TypeScript       |
| `npm start`    | Run production build     |
| `npm run dev`  | Run with ts-node-dev     |
| `npm test`     | Run Jest tests           |
| `npm run lint` | Run ESLint               |

## CI/CD

On every push/PR to `main`, GitHub Actions runs:

- Install: `npm ci`
- Build: `npm run build`
- Tests: `npm test`

Keep the default branch green before merging.

## Project structure

```
streampay-backend/
├── src/
│   ├── api/            # Versioned API routes
│   ├── db/             # Drizzle ORM schema and client
│   ├── metrics/        # Prometheus metrics logic and tests
│   ├── repositories/   # Data access layer
│   └── routes/         # Webhooks and other handlers
├── package.json
├── tsconfig.json
├── jest.config.js
├── .github/workflows/ci.yml
└── README.md
```

## License

MIT

## Smoke Testing
To run the E2E smoke tests against a local Docker stack:
1. `docker-compose up -d`
2. `./scripts/smoke.sh http://localhost:3000`

**Prerequisites:** `curl` must be installed.
