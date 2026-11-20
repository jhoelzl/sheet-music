import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { todayISO } from '../lib/dates'
import type { Composer, Piece } from '../supabase'
import { PracticeCalendar } from './PracticeCalendar'

afterEach(cleanup)

it('retains practice counts and piece details in the shared calendar', async () => {
  const piece: Piece = {
    id: 'p1', composer_id: 'c1', title: 'Romance', instruments: [], pdf_path: null,
    play_progress: 0, difficulty: null, rating: null, notes: null,
  }
  const composer: Composer = { id: 'c1', name: 'Clara Schumann', born_year: null, died_year: null, notes: null }
  const user = userEvent.setup()
  render(<PracticeCalendar pieces={[piece]} composers={[composer]}
    logs={[{ id: 'log1', piece_id: 'p1', practiced_on: todayISO() }]} />)
  const calendar = screen.getByRole('region', { name: 'Practice calendar' })
  expect(within(calendar).getByText('piece today')).toBeTruthy()
  await user.click(within(calendar).getByRole('button', { name: /1 piece practiced$/ }))
  expect(within(calendar).getByText('Romance')).toBeTruthy()
  expect(within(calendar).getByText('Clara Schumann')).toBeTruthy()
})
