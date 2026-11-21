import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TagInput } from './TagInput'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('adds comma-separated tags together without losing earlier entries', () => {
  const onChange = vi.fn()
  render(<TagInput tags={['jazz']} suggestions={[]} label="Tags" onChange={onChange} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Add tag' }), { target: { value: ' #Jazz, Theory, Scales, ' } })
  expect(onChange).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledWith(['jazz', 'theory', 'scales'])
})

it('confirms tag deletion for both the button and Backspace', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const onChange = vi.fn()
  render(<TagInput tags={['jazz']} suggestions={[]} label="Tags for Scales" onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete tag jazz' }))
  expect(confirm).toHaveBeenLastCalledWith('Delete tag "jazz" from Tags for Scales?')
  expect(onChange).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Add tag' }), { key: 'Backspace' })
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(onChange).toHaveBeenCalledWith([])
})
