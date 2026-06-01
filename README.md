# Timeline Generator

A React + TypeScript app for designing and exporting annotated timelines, with a small Node/Express + Postgres backend for persistence.

## Quick start

### 1. Postgres

Make sure Postgres is running locally and create a database for the app:

```sh
psql -U postgres -c "CREATE DATABASE timelinegen;"
```

### 2. Environment

Copy `.env.example` to `.env` and adjust if needed:

```sh
cp .env.example .env
```

The default connection string is:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/timelinegen
PORT=4000
```

The server auto-creates the `timelines` table on first boot.

### 3. Install & run

```sh
npm install
npm run dev:all     # Vite (web) + Node (api) together
```

Or run them separately in two terminals:

```sh
npm run dev         # Vite dev server  -> http://localhost:5173
npm run server:dev  # API with --watch -> http://localhost:4000
```

The Vite dev server proxies `/api/*` to the backend on port 4000.

## Routes

- `/` - Home page listing every saved timeline (create / open / rename / duplicate / delete).
- `/t/:id` - Editor for a single timeline. Changes auto-save (debounced) back to Postgres.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/timelines` | List summaries |
| `POST` | `/api/timelines` | Create a new timeline |
| `GET` | `/api/timelines/:id` | Fetch full timeline |
| `PUT` | `/api/timelines/:id` | Upsert full timeline body |
| `PATCH` | `/api/timelines/:id` | Rename only |
| `POST` | `/api/timelines/:id/duplicate` | Duplicate |
| `DELETE` | `/api/timelines/:id` | Delete |

## Scripts

- `npm run dev` - Vite dev server
- `npm run server` / `npm run server:dev` - API server (with `--watch`)
- `npm run dev:all` - both together via `concurrently`
- `npm run build` - production build
- `npm run lint` - ESLint
