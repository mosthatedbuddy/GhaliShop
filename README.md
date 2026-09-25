# GhaliShop

Storefront with a portable Node.js API. Runs on any Node hosting platform — a VPS, Docker, Render, Railway, Fly.io, Heroku, Vercel serverless functions, or a plain static host paired with a hosted database.

Products and orders are shared across every device through a single API. Browser storage is used only for a visitor's bag and favorites — never as a product database.

## Quick start (local)

```bash
npm install
npm start          # http://localhost:3000
```

Open `http://localhost:3000`, and the admin workspace at `http://localhost:3000/admin.html`.

- Admin password: `admin1234@@` (change `ADMIN_PASSWORD` in `.env`).
- The catalog is pre-seeded with 15 products on first run (`SEED_CATALOG=false` to start empty). Products and orders are stored in `data/products.json` and `data/orders.json`.
- Run the test suite: `npm test`.

## Architecture

- `server.js` — Express app + static files (`public/`) + JSON REST API (`/api/*`).
- `public/` — frontend (storefront, product page, cart/checkout, admin workspace).
- `src/storage/` — pluggable data layer:
  - `file` — JSON files on disk (default; persistent hosts, Docker volumes).
  - `memory` — in-memory, resets per restart (default on Vercel without a database).
  - `postgres` — durable shared storage (set `DATABASE_URL`).
- `api/index.js` — Vercel serverless entry point (thin wrapper around the same app).

Storage is chosen automatically:

| Condition | Driver |
|---|---|
| `STORAGE_DRIVER` explicitly set | that driver |
| `DATABASE_URL` set | `postgres` |
| Vercel environment (`VERCEL=1`) | `memory` (or `postgres` with `DATABASE_URL`) |
| anything else | `file` |

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port (server.js) |
| `HOST` | `0.0.0.0` | Bind address |
| `ADMIN_PASSWORD` | `admin1234@@` | Admin login password |
| `SESSION_SECRET` | — | **Required in production.** Signs admin session tokens. |
| `STORAGE_DRIVER` | auto | `file`, `memory`, or `postgres` |
| `STORAGE_DIR` | `data` | Directory for the `file` driver |
| `DATABASE_URL` | — | Postgres connection string (enables `postgres` driver) |
| `SEED_CATALOG` | `true` | Seed `data/seed-products.json` once on a fresh database |
| `FRONTEND_ORIGIN` | — | CORS allowlist (comma-separated) for the API if served from a separate origin |

Copy `.env.example` to `.env` for local overrides. The project never commits data files, `.env` files, or `node_modules` (see `.gitignore`).

## Deploying

### Docker (works on any VPS, Railway, Render, Fly.io, DigitalOcean App Platform...)

```bash
docker build -t ghalishop .
docker run -p 3000:3000 -e SESSION_SECRET=... -e ADMIN_PASSWORD=... -v ghalishop-data:/data ghalishop
```

The image writes JSON storage under `/data` — mount a persistent volume there.

### Render / Railway / Fly.io / Heroku / a plain VPS

1. Push this repository to Git and create an app from it.
2. Build command: `npm install`. Start command: `npm start`.
3. Set `SESSION_SECRET`, `ADMIN_PASSWORD`, and (for shared multi-instance storage) `DATABASE_URL`, or mount persistent disk at the project `data` directory for the `file` driver.

### Vercel (serverless)

1. Import the repository into Vercel. `vercel.json` configures the `api/index.js` function.
2. Set `SESSION_SECRET` and `ADMIN_PASSWORD`. Vercel's filesystem is read-only, so data lives in memory unless you add a Postgres database (`DATABASE_URL`).
3. Static files in `public/` are served as the website; API calls go to `/api/*`; admin at `/admin.html`.

### Static host without a server

Upload `public/` to any static host. Without an API, the storefront falls back to `public/catalog.json` for the catalog (a read-only snapshot); orders and admin will not work. For a self-checkout static demo, the cart and favorites still function client-side.

## API outline

| Method & path | Auth | Description |
|---|---|---|
| `GET /api/health` | — | Service health + storage driver |
| `GET /api/products` | — | Catalog |
| `PUT /api/products` | admin | Replace catalog (admin workspace) |
| `POST /api/admin/login` | — | Login, returns a session token |
| `POST /api/orders` | — | Place an order (cart checkout) |
| `GET /api/orders` | admin | Inbox of received orders |
| `PUT /api/orders` | admin | Update order status |

## Tests

`npm test` runs:

- `tests/smoke.test.js` — server boot, `file` storage, seeding, auth, CRUD, static file serving.
- `tests/serverless.test.js` — Vercel handler (`api/index.js`) with the `memory` driver.

## Security notes

- Never expose `SESSION_SECRET` or `ADMIN_PASSWORD` in the client. They live only on the server (or as platform environment variables).
- Serve production over HTTPS and set `FRONTEND_ORIGIN` when the API and storefront use different origins.
- The admin login is rate-limited to 10 attempts per minute per IP.