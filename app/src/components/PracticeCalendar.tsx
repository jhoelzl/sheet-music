import { useState } from 'react'
import type { Composer, Piece, PracticeLog } from '../supabase'
import { WEEKS, isoOf, todayISO } from '../lib/dates'
import { CloseIcon } from './icons'

export function PracticeCalendar({ logs, pieces, composers }: { logs: PracticeLog[]; pieces: Piece[]; composers: Composer[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const byDay = new Map<string, string[]>()
  for (const l of logs) byDay.set(l.practiced_on, [...(byDay.get(l.practiced_on) ?? []), l.piece_id])

  const todayStr = todayISO()
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const today = new Date(ty, tm - 1, td)
  const mondayOffset = (today.getDay() + 6) % 7
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset - (WEEKS - 1) * 7)
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
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
  const thisWeek = weekTotals(weeks[WEEKS - 1])
  const lastWeek = weekTotals(weeks[WEEKS - 2])
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
  const selectedPieces = selected ? (byDay.get(selected) ?? []).map((id) => pieces.find((p) => p.id === id)).filter((p): p is Piece => !!p) : []

  return (
    <section className="panel practice-cal" aria-label="Practice calendar">
      <div className="cal-head">
        <div className="cal-stats">
          <div><strong>{streak}</strong><span>day streak 🔥 · best {bestStreak}</span></div>
          <div><strong>{todayCount}</strong><span>{todayCount === 1 ? 'piece' : 'pieces'} today</span></div>
          <div><strong>{thisWeek.sessions}</strong><span>
            {thisWeek.sessions === 1 ? 'practice' : 'practices'} this week · {thisWeek.days}/7 days
            {weekDelta !== 0 && <em className={weekDelta > 0 ? 'up' : 'down'}> {weekDelta > 0 ? '▲' : '▼'} {Math.abs(weekDelta)} vs last week</em>}
          </span></div>
        </div>
      </div>
      <div className="cal-scroll">
        <div className="cal-months" style={{ gridTemplateColumns: `repeat(${WEEKS}, 14px)` }}>
          {monthLabels.map((m, i) => <span key={i}>{m}</span>)}
        </div>
        <div className="cal-grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, 14px)` }}>
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
                    title={`${dayLabel(iso)} · ${n} ${n === 1 ? 'piece' : 'pieces'}`}
                    aria-label={`${dayLabel(iso)}: ${n} ${n === 1 ? 'piece' : 'pieces'} practiced`}
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
            <span className="muted">{selectedPieces.length ? `${selectedPieces.length} ${selectedPieces.length === 1 ? 'piece' : 'pieces'} practiced` : 'Nothing practiced.'}</span>
            <button type="button" className="cal-detail-close" aria-label="Close details" onClick={() => setSelected(null)}>{CloseIcon}</button>
          </div>
          {selectedPieces.length > 0 && (
            <ul className="cal-detail-list">
              {selectedPieces.map((p) => (
                <li key={p.id}>
                  <span>{p.title}</span>
                  <span className="muted">{composers.find((c) => c.id === p.composer_id)?.name ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
