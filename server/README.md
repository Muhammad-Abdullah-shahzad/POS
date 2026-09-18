# POS API

Multi-tenant point of sale backend. Every registered company is a **tenant**. A
company owns its products, orders, customers, staff and settings, and no other
company can read or change them.

## How isolation works

Isolation is enforced in the data layer, not in individual controllers, so it
cannot be forgotten when a new endpoint is added.

1. **Sign in** resolves the account by email. The account belongs to exactly one
   company, so the company is never taken from user input.
2. **The access token** carries `tenantId`. `middleware/authenticate.ts` verifies
   it, confirms the company is active, and runs the rest of the request inside
   an `AsyncLocalStorage` scope pinned to that tenant.
3. **The `tenantScope` Mongoose plugin** (`models/plugins/tenantScope.ts`) reads
   that scope and:
   - adds `tenantId` to the filter of every find, count, update and delete
   - stamps `tenantId` on every created document and ignores any value the
     client sent
   - prepends a `$match` on `tenantId` to every aggregation
4. **It fails closed.** A tenant-scoped query with no scope throws
   `TenantScopeError` instead of returning every company's rows. Trusted
   internal work opts out explicitly with `withSystemScope()`.

Unique constraints are scoped to the company, so two shops can use the same
barcode, category name or receipt number.

`tests/tenantIsolation.test.ts` and `tests/api.test.ts` prove these guarantees,
including a second company probing the first company's records by id.

## Project layout

```
config/        validated environment and database connection
core/          errors, logging, tenant context, response envelope
middleware/    authentication, validation, rate limits, error handling
models/        Mongoose schemas; plugins/tenantScope.ts enforces isolation
services/      business logic: auth, tokens, onboarding, orders, sync
controllers/   thin HTTP handlers that call services and models
routes/        route table; routes/index.ts mounts everything under /api
validators/    zod schemas for request bodies, queries and params
scripts/       onboarding, migration and maintenance CLIs
tests/         isolation and API tests
```

## Getting started

```bash
cp .env.example .env
npm install
npm run db:indexes
npm run dev
```

`config/env.ts` validates configuration at boot and exits with a clear message
if something is missing. The JWT secrets must be at least 32 characters.

## Onboarding a company

A new company is one call. It creates the company, its first admin login, a
settings document and default expense categories.

From the command line:

```bash
npm run tenant:create -- --company "Corner Shop" --email owner@cornershop.ie --name "Aoife Byrne" --password "a-strong-password"
```

Over HTTP, authenticated with the operator key from `PLATFORM_API_KEY`:

```bash
curl -X POST http://localhost:5000/api/platform/tenants \
  -H "x-platform-key: $PLATFORM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"company":{"name":"Corner Shop","contactEmail":"owner@cornershop.ie"},"admin":{"name":"Aoife Byrne","email":"owner@cornershop.ie","password":"a-strong-password"}}'
```

The admin then signs in and adds cashiers through `POST /api/users`, or you add
them from the command line:

```bash
npm run user:create -- --tenant corner-shop --name "Sean Kelly" --email sean@cornershop.ie --password "a-strong-password" --role cashier
```

Suspending a company signs all of its users out:

```bash
curl -X PATCH http://localhost:5000/api/platform/tenants/<tenantId>/status \
  -H "x-platform-key: $PLATFORM_API_KEY" -H "Content-Type: application/json" \
  -d '{"status":"suspended","reason":"Unpaid invoice"}'
```

## Authentication

| Token | Lifetime | Stored as |
| --- | --- | --- |
| Access token (JWT) | 15 minutes | Not stored server side |
| Refresh token | 30 days | SHA-256 hash in `sessions` |

Each refresh rotates the refresh token. Reusing an old refresh token revokes
every session from that sign in, because reuse means the token was copied.
Changing a password revokes all of that user's sessions.

## Licensing

A company can only use the app while it has a licence in force. When the
licence lapses, the API answers data requests with status 402 and the web app
shows the renewal screen. The desktop till checks its cached key offline and
locks itself the same way, even with no internet connection.

A licence key is a signed statement that one company may use the app until a
date. The server signs keys with `LICENSE_SIGNING_KEY`. The desktop app checks
them with the matching public key in `electron/app.config.json`, so a till can
verify a key but never create one.

Generate the key pair once per deployment, then put both halves in `.env` and
the public half in `electron/app.config.json`:

```bash
npm run license:keys
```

A company gets its licence in one of three ways:

- **Self sign-up** at `POST /api/auth/register` starts a trial of
  `LICENSE_TRIAL_DAYS` days. Set `PUBLIC_SIGNUP_ENABLED=false` to onboard
  customers by hand only.
- **Operator onboarding** takes an optional licence term, or `null` to start
  the company locked.
- **Issuing after payment** adds the term to the current expiry, or starts from
  today when the licence has already lapsed.

```bash
npm run license:issue -- --tenant corner-shop --months 1
npm run tenant:list -- --expiring 7
```

The web app unlocks as soon as a licence is issued. The desktop till picks up
the new key on its next sign in, sync or hourly check, or straight away when
the customer pastes the key in.

Rotating the key pair invalidates every key issued so far.

## Migrating existing single-company data

Back up the database first. The migration drops the old global unique indexes.

```bash
npm run migrate:multitenant -- --company "My Shop" --email owner@myshop.ie --dry-run
npm run migrate:multitenant -- --company "My Shop" --email owner@myshop.ie
```

It assigns every existing record to that company, rebuilds indexes as
tenant-scoped, renumbers receipts per company and keeps one settings document.
It also issues an opening paid licence of one month and prints the key. Change
the term with `--license-months`, or skip it with `--no-license`. Running it
again is safe, and existing logins keep their passwords.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with reload |
| `npm test` | Run the test suite against `MONGO_TEST_URI` or a local `pos_system_test` |
| `npm run typecheck` | Type check without emitting |
| `npm run db:indexes` | Build model indexes; run on every deploy |
| `npm run tenant:create` | Onboard a company |
| `npm run tenant:list` | List companies with their licence, optionally only those expiring soon |
| `npm run user:create` | Add a staff login to a company |
| `npm run license:keys` | Generate the licence signing key pair |
| `npm run license:issue` | Issue or extend a company's licence and print the key |
| `npm run seed:categories` | Add starter product categories to a company |
| `npm run migrate:multitenant` | One-off migration of legacy data |

## Production checklist

- Set `NODE_ENV=production`, which enables rate limiting and hides stack traces.
- Set `CORS_ORIGINS` to the web client origin.
- Generate new values for `JWT_SECRET`, `JWT_REFRESH_SECRET` and `PLATFORM_API_KEY`.
- Generate a production licence key pair with `npm run license:keys`, keep the
  signing key backed up, and ship the matching public key in the desktop build.
- Run MongoDB as a replica set so onboarding runs in a transaction.
- Run `npm run db:indexes` during each deploy.
