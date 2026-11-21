import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Rating } from './Rating'

afterEach(cleanup)

describe.each([
  ['Rating', '★'],
  ['Difficulty', '●'],
])('%s', (label, glyph) => {
  it('previews only the hovered points and restores the saved value on mouse leave', async () => {
    const user = userEvent.setup()
    render(<Rating label={label} glyph={glyph} value={4} onChange={vi.fn()} />)
    const group = screen.getByRole('group', { name: label })
    const buttons = within(group).getAllByRole('button')

    await user.hover(buttons[1])
    expect(buttons.map((button) => button.classList.contains('preview'))).toEqual([true, true, false, false, false])
    expect(buttons.map((button) => button.classList.contains('on'))).toEqual([true, true, false, false, false])

    await user.hover(buttons[4])
    expect(buttons.map((button) => button.classList.contains('preview'))).toEqual([true, true, true, true, true])
    await user.unhover(buttons[4])
    expect(buttons.map((button) => button.classList.contains('preview'))).toEqual([false, false, false, false, false])
    expect(buttons.map((button) => button.classList.contains('on'))).toEqual([true, true, true, true, false])
  })

  it('previews keyboard focus and retains click-to-clear behavior', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Rating label={label} glyph={glyph} value={2} onChange={onChange} />)
    const buttons = within(screen.getByRole('group', { name: label })).getAllByRole('button')

    await user.tab()
    expect(buttons.map((button) => button.classList.contains('preview'))).toEqual([true, false, false, false, false])
    await user.click(buttons[1])
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
