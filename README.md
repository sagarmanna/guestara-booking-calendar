# Guestara Booking Calendar Heatmap

A single-page React application for visualizing hotel bookings as an interactive occupancy heatmap calendar.

**Live Demo:** https://guestara-booking-calendar.vercel.app/

## Overview

This app helps a hotel front desk quickly answer: how full are we this month, and what bookings are coming up?

It loads booking data from `public/bookings.json`, calculates nightly room occupancy across 10 rooms, and renders a month-view heatmap where darker cells indicate higher occupancy.

## Features

- Month-view calendar with visible previous/next month dates
- Occupancy heatmap showing occupied rooms per night
- Correct hotel date logic: `checkIn` is included, `checkOut` is excluded
- Cancelled bookings do not count toward occupancy
- Previous, Today, and Next month navigation
- Native drag-to-select date ranges
- Forward, backward, and cross-month drag selection
- Booking detail panel for selected dates
- Loading and error states for async JSON fetching
- Filters by status, room type, and source
- Guest search with calendar highlighting
- Month-level stats
- CSV and Excel export for selected bookings
- Persists last viewed month and filters with `localStorage`
- Empty month guidance with quick jumps to the loaded data range

## Tech Stack

- React
- Vite
- Plain CSS
- Native JavaScript `Date`

No calendar libraries, date libraries, drag-and-drop libraries, backend, or UI component libraries are used.

## Run Locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually:

```text
http://127.0.0.1:5173
```

## Verify

```bash
npm run lint
npm run build
```

## Data

The app loads:

```text
public/bookings.json
```

The current fixture is a top-level JSON array with 201 bookings across 10 rooms over a 4-month window.

The loader supports both:

```json
[ { "id": "BK1000" } ]
```

and:

```json
{ "bookings": [ { "id": "BK1000" } ] }
```

It also normalizes both `totalAmount` and `amount`, plus status formats like `checked_in`, `checked_out`, and `checked-in`.

## Notes

See [NOTES.md](./NOTES.md) for open-scope choices, trade-offs, and what I would improve with more time.
