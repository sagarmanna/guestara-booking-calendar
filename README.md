# Guestara Booking Calendar Heatmap

Single-page React app for visualizing hotel occupancy as an interactive month heatmap.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://127.0.0.1:5173`.

## Verify

```bash
npm run lint
npm run build
```

## Data

The app loads `public/bookings.json` with `fetch('/bookings.json')`. The fixture is a top-level JSON array with 201 bookings across 10 rooms over a 4-month window.

The loader also supports a `{ "bookings": [...] }` wrapper, so either common assignment format works.

Cancelled bookings are shown when filtered directly, but they never count toward occupancy.
