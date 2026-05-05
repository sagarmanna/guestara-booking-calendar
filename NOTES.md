# Notes

## Open-scope features

I added filtering by status, room type, booking source, and guest search. The heatmap and selected-range details both update from the same filtered booking set, so the filters feel integrated instead of bolted on.

I also added a stats strip and CSV export for the selected date range. These help a front desk user move from "how full are we?" to "what do I need to act on?"

The app persists the last viewed month and non-search filters in `localStorage`, because those are likely preferences a returning operator would expect to keep.

The data loader normalizes both the original fixture shape and the updated assignment shape, including `totalAmount`, `checked_in`, and `checked_out`.

## Date logic

The heatmap uses the hotel convention that `checkIn` is inclusive and `checkOut` is exclusive. A booking from `2026-02-10` to `2026-02-13` counts on Feb 10, 11, and 12 only.

The grid is Monday-first. That is common for operations teams scanning work weeks. Previous and next month cells remain visible and selectable so dragging across month boundaries works.

## Trade-offs

The mock data is deterministic and stored in `public/bookings.json`. In a production app I would source it from the provided API or a shared fixture generator.

The app is intentionally desktop-first because the brief says mobile is not required. Basic responsive behavior exists, but desktop density and scanability were prioritized.

## With more time

I would split the date helpers and larger view components into separate files, add unit tests for the inclusive-exclusive date math, and add keyboard range selection.
