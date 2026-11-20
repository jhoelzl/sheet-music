import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TagInput } from './TagInput'

afterEach(cleanup)

it('adds comma-separated tags together without losing earlier entries', () => {
  const onChange = vi.fn()
  render(<TagInput tags={['jazz']} suggestions={[]} label="Tags" onChange={onChange} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Add tag' }), { target: { value: ' #Jazz, Theory, Scales, ' } })
  expect(onChange).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledWith(['jazz', 'theory', 'scales'])
})
