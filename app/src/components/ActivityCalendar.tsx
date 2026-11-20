import { useState } from 'react'
import { PRACTICE_CALENDAR_WEEKS } from '../config'
import { isoOf, todayISO } from '../lib/dates'
import { CloseIcon } from './icons'

// Show the most recent weeks first when the heatmap overflows (small screens).
const scrollToEnd = (el: HTMLDivElement | null) => { if (el) el.scrollLeft = el.scrollWidth }

export type CalendarEntry = { id: string; date: string; title?: string; subtitle?: string }

export function ActivityCalendar({ entries, kind, onSelectEntry, selectionDisabled = false }: {
  entries: CalendarEntry[]
  kind: 'practice' | 'lesson'
  onSelectEntry?: (id: string) => void
  selectionDisabled?: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const byDay = new Map<string, CalendarEntry[]>()
  for (const entry of entries) byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), entry])

  const todayStr = todayISO()
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const today = new Date(ty, tm - 1, td)
  const mondayOffset = (today.getDay() + 6) % 7
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset - (PRACTICE_CALENDAR_WEEKS - 1) * 7)
  const weeks = Array.from({ length: PRACTICE_CALENDAR_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)))

  // The streak survives until the end of today, so it still counts when today has no entry yet.
  let streak = 0
  const cursor = new Date(today)
  if (!byDay.has(todayStr)) cursor.setDate(cursor.getDate() - 1)
  while (byDay.has(isoOf(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1) }

  // Longest run of consecutive practice days across the whole log.
  let bestStreak = 0
  let run = 0
  let prev: number | null = null
  for (const iso of [...byDay.keys()].sort()) {
    const [y, m, d] = iso.split('-').map(Number)
    const t = Date.UTC(y, m - 1, d)
    run = prev !== null && t - prev === 86400000 ? run + 1 : 1
    prev = t
    bestStreak = Math.max(bestStreak, run)
  }
  bestStreak = Math.max(bestStreak, streak)

  const weekTotals = (w: Date[]) => {
    const ids = w.flatMap((d) => byDay.get(isoOf(d)) ?? [])
    return { days: w.filter((d) => byDay.has(isoOf(d))).length, sessions: ids.length }
  }
  const thisWeek = weekTotals(weeks[PRACTICE_CALENDAR_WEEKS - 1])
  const lastWeek = weekTotals(weeks[PRACTICE_CALENDAR_WEEKS - 2])
  const weekDelta = thisWeek.sessions - lastWeek.sessions
  const todayCount = byDay.get(todayStr)?.length ?? 0
  const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4)
  const dayLabel = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }
  const monthLabels = weeks.map((w, i) => {
    const monthStart = w.find((d) => d.getDate() === 1)
    return i === 0 ? (weeks[1].some((d) => d.getDate() === 1) ? '' : w[0].toLocaleDateString(undefined, { month: 'short' })) : monthStart ? monthStart.toLocaleDateString(undefined, { month: 'short' }) : ''
  })
  const selectedEntries = selected ? (byDay.get(selected) ?? []).filter((entry) => entry.title !== undefined) : []
  const countLabel = (n: number) => kind === 'practice' ? (n === 1 ? 'piece' : 'pieces') : (n === 1 ? 'lesson' : 'lessons')
  const activityLabel = (n: number) => kind === 'practice' ? (n === 1 ? 'practice' : 'practices') : countLabel(n)
  const detailLabel = (n: number) => kind === 'practice'
    ? `${n} ${countLabel(n)} practiced`
    : `${n} ${countLabel(n)}`

  return (
    <section className="panel practice-cal" aria-label={kind === 'practice' ? 'Practice calendar' : 'Lesson calendar'}>
      <div className="cal-head">
        <div className="cal-stats">
          <div><strong>{streak}</strong><span>day streak 🔥 · best {bestStreak}</span></div>
          <div><strong>{todayCount}</strong><span>{countLabel(todayCount)} today</span></div>
          <div><strong>{thisWeek.sessions}</strong><span>
            {activityLabel(thisWeek.sessions)} this week · {thisWeek.days}/7 days
            {weekDelta !== 0 && <em className={weekDelta > 0 ? 'up' : 'down'}> {weekDelta > 0 ? '▲' : '▼'} {Math.abs(weekDelta)} vs last week</em>}
          </span></div>
        </div>
      </div>
      <div className="cal-scroll" ref={scrollToEnd}>
        <div className="cal-months" style={{ gridTemplateColumns: `repeat(${PRACTICE_CALENDAR_WEEKS}, 14px)` }}>
          {monthLabels.map((m, i) => <span key={i}>{m}</span>)}
        </div>
        <div className="cal-grid" style={{ gridTemplateColumns: `repeat(${PRACTICE_CALENDAR_WEEKS}, 14px)` }}>
          {weeks.map((w, wi) => (
            <div className="cal-col" key={wi}>
              {w.map((d) => {
                const iso = isoOf(d)
                const n = byDay.get(iso)?.length ?? 0
                if (d > today) return <span className="cal-cell future" key={iso} />
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`cal-cell l${level(n)}${iso === todayStr ? ' today' : ''}${iso === selected ? ' sel' : ''}`}
                    title={`${dayLabel(iso)} · ${n} ${countLabel(n)}`}
                    aria-label={`${dayLabel(iso)}: ${detailLabel(n)}`}
                    onClick={() => setSelected(selected === iso ? null : iso)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {selected && (
        <div className="cal-detail">
          <div className="cal-detail-head">
            <strong>{dayLabel(selected)}</strong>
            <span className="muted">{selectedEntries.length ? detailLabel(selectedEntries.length) : kind === 'practice' ? 'Nothing practiced.' : 'No lessons.'}</span>
            <button type="button" className="cal-detail-close" aria-label="Close details" onClick={() => setSelected(null)}>{CloseIcon}</button>
          </div>
          {selectedEntries.length > 0 && (
            <ul className="cal-detail-list">
              {selectedEntries.map((entry) => (
                <li key={entry.id}>
                  {onSelectEntry
                    ? <button type="button" className="lesson-calendar-entry" disabled={selectionDisabled} onClick={() => onSelectEntry(entry.id)}>{entry.title}</button>
                    : <span>{entry.title}</span>}
                  {entry.subtitle && <span className="muted">{entry.subtitle}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
