# Timegrid

**Timegrid** is a visual editor for designing, annotating, and exporting process timelines — the kind of diagrams you'd otherwise piece together in PowerPoint or Visio with misaligned rectangles and stray text boxes. Define a sequence of phases (with durations or absolute dates), layer on guides and brackets to call out milestones and spans, and Timegrid lays everything out on a precise day-based grid that you can export as SVG, PNG, or PDF.

It's built for engineers, PMs, and security responders who repeatedly produce the same shape of diagram — release trains, incident response packages, deployment waves, project phase plans — and want a tool that treats time as a first-class axis instead of a free-form canvas.

## What it does

- **Day-precise layout.** Pick a zoom (pixels per day) and every block, guide, and bracket snaps to the same time scale. No more eyeballing widths.
- **Two input modes.** Author phases as durations (e.g. "14 days") or as absolute date ranges; switch modes per timeline.
- **Stacked rows.** Multiple parallel tracks on the same timeline for showing concurrent workstreams.
- **Guides.** Vertical lines marking specific days/events ("Bug Cutoff", "Last possible day new case can come in"), with collision-avoiding label lanes above or below the chart.
- **Brackets.** Horizontal spans calling out a sub-range ("~21 days", "Assessment window") with adjustable Y offsets so labels don't fight each other.
- **Auto-fitting header/footer.** The canvas reserves only as much vertical space as your labels actually need, per item, so pulling a label down doesn't leave dead space at the top.
- **Inspector + JSON editor.** Tweak any element via a properties panel, or edit the raw timeline JSON directly.
- **Undo/redo** on every change (via `zundo`).
- **Persistent storage.** Timelines are saved to Postgres through a small Express API; the home page lists every saved timeline with create / open / rename / duplicate / delete.
- **Compare view.** Open multiple timelines side-by-side at `/compare?ids=...` to diff release plans or proposed schedules.
- **Export.** SVG, PNG, and PDF export of the rendered timeline.
- **Light/dark themes** with a toggle.

## Stack

- **Frontend:** React 19 + TypeScript + Vite, Zustand + zundo for state, Zod for schema validation, React Router for navigation, react-colorful for color pickers, jsPDF for PDF export.
- **Backend:** Node + Express + `pg`, Postgres for storage. Auto-creates its table on first boot.
- **Dev:** `concurrently` to run web + api together, ESLint, TypeScript strict mode.

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

- `/` — Home page listing every saved timeline (create / open / rename / duplicate / delete).
- `/t/:id` — Editor for a single timeline. Changes auto-save (debounced) back to Postgres.
- `/compare?ids=a,b,c` — Side-by-side comparison view for multiple timelines.

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

- `npm run dev` — Vite dev server
- `npm run server` / `npm run server:dev` — API server (with `--watch`)
- `npm run dev:all` — both together via `concurrently`
- `npm run build` — production build
- `npm run lint` — ESLint

## Project layout

```
src/
  components/   UI: TimelineCanvas, Inspector, Toolbar, JsonEditor, ...
  render/       Pure layout math: scale, bracket/guide layout, label fitting
  model/        Zod schemas for the timeline document
  state/        Zustand store with undo history
  io/           Export (SVG / PNG / PDF)
  data/         Built-in example timelines
server/
  index.js      Express + Postgres API
```
