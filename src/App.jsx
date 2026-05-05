import { useEffect, useMemo, useState } from 'react'
import './App.css'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const ROOM_COUNT = 10
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const statusLabels = {
  all: 'All active',
  confirmed: 'Confirmed',
  'checked-in': 'Checked in',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  pending: 'Pending',
  cancelled: 'Cancelled',
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`)
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function nightsBetween(start, end) {
  return Math.max(0, Math.round((parseDate(end) - parseDate(start)) / MS_PER_DAY))
}

function formatDate(date) {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function labelStatus(status) {
  return statusLabels[status] ?? status.replaceAll(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeBooking(booking) {
  return {
    ...booking,
    guestName: booking.guestName ?? booking.guest ?? 'Unknown guest',
    roomNumber: String(booking.roomNumber ?? booking.room ?? ''),
    roomType: booking.roomType ?? booking.type ?? 'Room',
    source: booking.source ?? 'Direct',
    amount: Number(booking.amount ?? booking.totalAmount ?? 0),
    currency: booking.currency ?? 'INR',
    status: booking.status ?? 'confirmed',
  }
}

function getMonthCells(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = addDays(firstOfMonth, -mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    return {
      date,
      key: dateKey(date),
      inCurrentMonth: date.getMonth() === monthDate.getMonth(),
    }
  })
}

function getOrderedRange(startKey, endKey) {
  const start = parseDate(startKey)
  const end = parseDate(endKey)
  return start <= end
    ? { startKey, endKey }
    : { startKey: endKey, endKey: startKey }
}

function isDateInRange(key, range) {
  return range && key >= range.startKey && key <= range.endKey
}

function bookingOccupiesNight(booking, key) {
  return booking.status !== 'cancelled' && booking.checkIn <= key && key < booking.checkOut
}

function bookingOverlapsRange(booking, range) {
  if (!range) return false
  const rangeEndExclusive = dateKey(addDays(parseDate(range.endKey), 1))
  return booking.checkIn < rangeEndExclusive && booking.checkOut > range.startKey
}

function occupancyForDate(bookings, key) {
  const occupiedRooms = new Set()
  bookings.forEach((booking) => {
    if (bookingOccupiesNight(booking, key)) {
      occupiedRooms.add(booking.roomNumber)
    }
  })
  return occupiedRooms.size
}

function App() {
  const today = useMemo(() => new Date(), [])
  const [bookings, setBookings] = useState([])
  const [rooms, setRooms] = useState([])
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' })
  const [viewMonth, setViewMonth] = useState(() => {
    const savedMonth = localStorage.getItem('guestara:viewMonth')
    const usableMonth = savedMonth ?? dateKey(new Date(today.getFullYear(), today.getMonth(), 1)).slice(0, 7)
    return parseDate(`${usableMonth}-01`)
  })
  const [filters, setFilters] = useState(() => ({
    status: localStorage.getItem('guestara:status') ?? 'all',
    roomType: localStorage.getItem('guestara:roomType') ?? 'all',
    source: localStorage.getItem('guestara:source') ?? 'all',
    search: '',
  }))
  const [drag, setDrag] = useState(null)
  const [selection, setSelection] = useState(() => {
    const key = dateKey(today)
    return { startKey: key, endKey: key }
  })

  useEffect(() => {
    async function loadBookings() {
      try {
        setLoadState({ status: 'loading', error: '' })
        const response = await fetch('/bookings.json')
        if (!response.ok) {
          throw new Error(`Could not load bookings.json (${response.status})`)
        }
        const payload = await response.json()
        const nextBookings = Array.isArray(payload) ? payload : payload.bookings
        if (!Array.isArray(nextBookings)) {
          throw new Error('bookings.json must contain an array or a { bookings } array.')
        }
        const normalizedBookings = nextBookings.map(normalizeBooking)
        setBookings(normalizedBookings)
        setRooms(Array.isArray(payload.rooms) ? payload.rooms : [])
        if (!localStorage.getItem('guestara:viewMonth') && normalizedBookings.length) {
          setViewMonth(parseDate(`${normalizedBookings[0].checkIn.slice(0, 7)}-01`))
        }
        setLoadState({ status: 'success', error: '' })
      } catch (error) {
        setLoadState({ status: 'error', error: error.message })
      }
    }

    loadBookings()
  }, [])

  useEffect(() => {
    localStorage.setItem('guestara:viewMonth', dateKey(viewMonth).slice(0, 7))
  }, [viewMonth])

  useEffect(() => {
    localStorage.setItem('guestara:status', filters.status)
    localStorage.setItem('guestara:roomType', filters.roomType)
    localStorage.setItem('guestara:source', filters.source)
  }, [filters.status, filters.roomType, filters.source])

  const roomTypes = useMemo(() => [...new Set(bookings.map((booking) => booking.roomType))].sort(), [bookings])
  const sources = useMemo(() => [...new Set(bookings.map((booking) => booking.source))].sort(), [bookings])
  const statusOptions = useMemo(() => ['all', ...new Set(bookings.map((booking) => booking.status))], [bookings])
  const dataRange = useMemo(() => {
    if (!bookings.length) return null
    const sortedStarts = bookings.map((booking) => booking.checkIn).sort()
    const sortedEnds = bookings.map((booking) => booking.checkOut).sort()
    return {
      startMonth: sortedStarts[0].slice(0, 7),
      endMonth: sortedEnds.at(-1).slice(0, 7),
    }
  }, [bookings])

  const filteredBookings = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    const activeStatus = filters.status === 'checked-in' ? 'checked_in' : filters.status
    return bookings.filter((booking) => {
      const statusMatch = activeStatus === 'all'
        ? booking.status !== 'cancelled'
        : booking.status === activeStatus
      const roomTypeMatch = filters.roomType === 'all' || booking.roomType === filters.roomType
      const sourceMatch = filters.source === 'all' || booking.source === filters.source
      const searchMatch = !search || booking.guestName.toLowerCase().includes(search)
      return statusMatch && roomTypeMatch && sourceMatch && searchMatch
    })
  }, [bookings, filters])

  const heatmapBookings = useMemo(
    () => filteredBookings.filter((booking) => booking.status !== 'cancelled'),
    [filteredBookings],
  )

  const monthCells = useMemo(() => getMonthCells(viewMonth), [viewMonth])
  const activeRange = drag ? getOrderedRange(drag.startKey, drag.hoverKey) : selection
  const monthRange = useMemo(() => {
    const startKey = dateKey(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1))
    const endKey = dateKey(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0))
    return { startKey, endKey }
  }, [viewMonth])
  const monthHasBookings = useMemo(
    () => heatmapBookings.some((booking) => bookingOverlapsRange(booking, monthRange)),
    [heatmapBookings, monthRange],
  )

  const selectedBookings = useMemo(() => {
    return filteredBookings
      .filter((booking) => bookingOverlapsRange(booking, selection))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.roomNumber.localeCompare(b.roomNumber))
  }, [filteredBookings, selection])

  const monthStats = useMemo(() => {
    const monthKeys = monthCells.filter((cell) => cell.inCurrentMonth).map((cell) => cell.key)
    const occupiedNights = monthKeys.reduce((total, key) => total + occupancyForDate(heatmapBookings, key), 0)
    const revenue = heatmapBookings
      .filter((booking) => bookingOverlapsRange(booking, { startKey: monthKeys[0], endKey: monthKeys.at(-1) }))
      .reduce((total, booking) => total + booking.amount, 0)
    const longestStay = heatmapBookings.reduce((max, booking) => Math.max(max, nightsBetween(booking.checkIn, booking.checkOut)), 0)
    const roomTypeCounts = heatmapBookings.reduce((counts, booking) => {
      counts[booking.roomType] = (counts[booking.roomType] ?? 0) + 1
      return counts
    }, {})
    const topRoomType = Object.entries(roomTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No bookings'

    return {
      averageOccupancy: Math.round((occupiedNights / (monthKeys.length * ROOM_COUNT)) * 100),
      revenue,
      longestStay,
      topRoomType,
    }
  }, [heatmapBookings, monthCells])

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function startSelection(key) {
    setDrag({ startKey: key, hoverKey: key })
    setSelection({ startKey: key, endKey: key })
  }

  function moveSelection(key) {
    setDrag((current) => current ? { ...current, hoverKey: key } : current)
  }

  function finishSelection(key) {
    setDrag((current) => {
      if (!current) return null
      const nextRange = getOrderedRange(current.startKey, key)
      setSelection(nextRange)
      return null
    })
  }

  function exportSelectedCsv() {
    const rows = [
      ['Booking ID', 'Guest Name', 'Room Number', 'Room Type', 'Check-in Date', 'Check-out Date', 'Nights', 'Status', 'Source', 'Amount'],
      ...selectedBookings.map((booking) => [
        booking.id,
        booking.guestName,
        `Room ${booking.roomNumber}`,
        booking.roomType,
        `="${booking.checkIn}"`,
        `="${booking.checkOut}"`,
        nightsBetween(booking.checkIn, booking.checkOut),
        labelStatus(booking.status),
        booking.source,
        booking.amount,
      ]),
    ]
    const csv = [
      'sep=,',
      ...rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `guestara-${selection.startKey}-to-${selection.endKey}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportSelectedExcel() {
    const rows = selectedBookings.map((booking) => [
      booking.id,
      booking.guestName,
      `Room ${booking.roomNumber}`,
      booking.roomType,
      booking.checkIn,
      booking.checkOut,
      nightsBetween(booking.checkIn, booking.checkOut),
      labelStatus(booking.status),
      booking.source,
      currency.format(booking.amount),
    ])
    const headers = ['Booking ID', 'Guest Name', 'Room Number', 'Room Type', 'Check-in Date', 'Check-out Date', 'Nights', 'Status', 'Source', 'Amount']
    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            table { border-collapse: collapse; font-family: Arial, sans-serif; }
            th { background: #26765a; color: #ffffff; font-weight: 700; }
            th, td { border: 1px solid #b8c8c0; padding: 8px 10px; white-space: nowrap; }
            .id { width: 95px; }
            .guest { width: 180px; }
            .room { width: 105px; }
            .type { width: 120px; }
            .date { width: 125px; mso-number-format: "\\@"; }
            .nights { width: 70px; text-align: right; }
            .status { width: 110px; }
            .source { width: 125px; }
            .amount { width: 115px; text-align: right; }
          </style>
        </head>
        <body>
          <table>
            <thead><tr>${headers.map((header, index) => `<th class="${['id', 'guest', 'room', 'type', 'date', 'date', 'nights', 'status', 'source', 'amount'][index]}">${header}</th>`).join('')}</tr></thead>
            <tbody>
              ${rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${['id', 'guest', 'room', 'type', 'date', 'date', 'nights', 'status', 'source', 'amount'][index]}">${String(cell).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `guestara-${selection.startKey}-to-${selection.endKey}.xls`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loadState.status === 'loading') {
    return <StateScreen title="Loading bookings" message="Fetching public/bookings.json..." />
  }

  if (loadState.status === 'error') {
    return (
      <StateScreen
        title="Could not load bookings"
        message={loadState.error}
        action={<button type="button" onClick={() => window.location.reload()}>Retry</button>}
      />
    )
  }

  return (
    <main className="heatmap-app" onMouseLeave={() => drag && setDrag(null)}>
      <header className="hero-bar">
        <div>
          <span className="eyebrow">Guestara Front Desk</span>
          <h1>Booking Calendar Heatmap</h1>
        </div>
        <div className="month-controls">
          <button type="button" onClick={() => setViewMonth((month) => addMonths(month, -1))}>Previous</button>
          <button type="button" onClick={() => setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>
          <button type="button" onClick={() => setViewMonth((month) => addMonths(month, 1))}>Next</button>
        </div>
      </header>

      <section className="toolbar" aria-label="Filters">
        <label>
          Status
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            {statusOptions.map((value) => (
              <option key={value} value={value}>{labelStatus(value)}</option>
            ))}
          </select>
        </label>
        <label>
          Room type
          <select value={filters.roomType} onChange={(event) => updateFilter('roomType', event.target.value)}>
            <option value="all">All room types</option>
            {roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>
          Source
          <select value={filters.source} onChange={(event) => updateFilter('source', event.target.value)}>
            <option value="all">All sources</option>
            {sources.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
        </label>
        <label className="search-label">
          Search
          <input
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Guest name"
          />
        </label>
      </section>

      <section className="stats-strip" aria-label="Month statistics">
        <Metric label="Average occupancy" value={`${monthStats.averageOccupancy}%`} />
        <Metric label="Visible bookings" value={filteredBookings.length} />
        <Metric label="Month revenue" value={currency.format(monthStats.revenue)} />
        <Metric label="Longest stay" value={`${monthStats.longestStay} nights`} />
        <Metric label="Top room type" value={monthStats.topRoomType} />
      </section>

      <section className="main-grid">
        <section className="calendar-card">
          <div className="calendar-title">
            <div>
              <h2>{viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
              <p>{rooms.length || ROOM_COUNT} rooms tracked. Checkout day is not counted as occupied.</p>
            </div>
            <div className="legend" aria-label="Heatmap legend">
              <span>0</span>
              <span className="legend-step step-1"></span>
              <span className="legend-step step-2"></span>
              <span className="legend-step step-3"></span>
              <span className="legend-step step-4"></span>
              <span>10 rooms</span>
            </div>
          </div>

          {!monthHasBookings && dataRange && (
            <div className="month-empty-banner">
              <div>
                <strong>No occupancy in this month</strong>
                <span>The loaded booking data runs from {dataRange.startMonth} through {dataRange.endMonth}. This view is still selectable, but every night is open.</span>
              </div>
              <div className="range-jumps">
                <button type="button" onClick={() => setViewMonth(parseDate(`${dataRange.startMonth}-01`))}>First data month</button>
                <button type="button" onClick={() => setViewMonth(parseDate(`${dataRange.endMonth}-01`))}>Latest data month</button>
              </div>
            </div>
          )}

          <div className="weekday-row">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className="heatmap-grid" onMouseUp={() => drag && finishSelection(drag.hoverKey)}>
            {monthCells.map((cell) => {
              const occupied = occupancyForDate(heatmapBookings, cell.key)
              const level = Math.min(4, Math.ceil((occupied / ROOM_COUNT) * 4))
              const occupancyPercent = Math.round((occupied / ROOM_COUNT) * 100)
              const selected = isDateInRange(cell.key, activeRange)
              const matchingSearch = filters.search && filteredBookings.some((booking) => bookingOccupiesNight(booking, cell.key))

              return (
                <button
                  className={`heatmap-cell heat-${level} ${cell.inCurrentMonth ? '' : 'dimmed'} ${selected ? 'range-selected' : ''} ${matchingSearch ? 'search-hit' : ''}`}
                  type="button"
                  key={cell.key}
                  onMouseDown={() => startSelection(cell.key)}
                  onMouseEnter={() => moveSelection(cell.key)}
                  onMouseUp={() => finishSelection(cell.key)}
                  title={`${formatDate(cell.date)}: ${occupied}/${ROOM_COUNT} rooms occupied`}
                >
                  <span className="day-number">{cell.date.getDate()}</span>
                  <span className="cell-copy">
                    <strong>{occupied}</strong>
                    <small>{occupancyPercent}% occupied</small>
                  </span>
                  <span className="occupancy-track" aria-hidden="true">
                    <span style={{ width: `${occupancyPercent}%` }}></span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <aside className="details-card">
          <div className="details-header">
            <div>
              <span className="eyebrow">Selected range</span>
              <h2>{selection.startKey === selection.endKey ? formatDate(parseDate(selection.startKey)) : `${formatDate(parseDate(selection.startKey))} - ${formatDate(parseDate(selection.endKey))}`}</h2>
            </div>
            <div className="export-actions">
              <button type="button" onClick={exportSelectedCsv} disabled={!selectedBookings.length}>Export CSV</button>
              <button type="button" onClick={exportSelectedExcel} disabled={!selectedBookings.length}>Export Excel</button>
            </div>
          </div>

          <div className="booking-list">
            {selectedBookings.length ? selectedBookings.map((booking) => (
              <article className="booking-row" key={booking.id}>
                <div>
                  <strong>{booking.guestName}</strong>
                  <span>Room {booking.roomNumber} · {booking.roomType}</span>
                </div>
                <dl>
                  <div><dt>Check-in</dt><dd>{booking.checkIn}</dd></div>
                  <div><dt>Check-out</dt><dd>{booking.checkOut}</dd></div>
                  <div><dt>Nights</dt><dd>{nightsBetween(booking.checkIn, booking.checkOut)}</dd></div>
                  <div><dt>Status</dt><dd className={`status ${booking.status}`}>{labelStatus(booking.status)}</dd></div>
                </dl>
              </article>
            )) : (
              <p className="empty-state">No bookings overlap this selection. Try dragging across another date range.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  )
}

function Metric({ label, value }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function StateScreen({ title, message, action }) {
  return (
    <main className="state-screen">
      <section>
        <span className="eyebrow">Guestara</span>
        <h1>{title}</h1>
        <p>{message}</p>
        {action}
      </section>
    </main>
  )
}

export default App
