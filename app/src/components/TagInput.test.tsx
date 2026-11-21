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

it('selects a visible existing tag and preserves a pending custom tag on touch', () => {
  const onChange = vi.fn()
  render(<TagInput tags={['jazz']} suggestions={['jazz', 'blues']} label="Score" suggestionButtons onChange={onChange} />)
  const input = screen.getByRole('textbox', { name: 'Add tag' })
  const choice = screen.getByRole('button', { name: '#blues' })
  expect(screen.getByRole('button', { name: '#jazz' }).getAttribute('aria-pressed')).toBe('true')
  expect(choice.getAttribute('aria-pressed')).toBe('false')
  expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.change(input, { target: { value: 'new tag' } })
  fireEvent.pointerDown(choice, { pointerType: 'touch' })
  fireEvent.blur(input)
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(choice)
  expect(onChange).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledWith(['jazz', 'blues', 'new tag'])
  expect(input).toHaveProperty('value', '')
})

it('retains the pending draft when selecting a tag reaches the custom-tag limit', () => {
  const tags = Array.from({ length: 19 }, (_, index) => `tag${index}`)
  const onChange = vi.fn()
  render(<TagInput tags={tags} suggestions={['blues']} label="Score" suggestionButtons onChange={onChange} />)
  const input = screen.getByRole('textbox', { name: 'Add tag' })
  const choice = screen.getByRole('button', { name: '#blues' })
  fireEvent.change(input, { target: { value: 'draft' } })
  fireEvent.pointerDown(choice)
  fireEvent.blur(input)
  fireEvent.click(choice)
  expect(onChange).toHaveBeenCalledWith([...tags, 'blues'])
  expect(input).toHaveProperty('value', 'draft')
})

it('preserves a pending draft if removal of a selected tag is cancelled', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const onChange = vi.fn()
  render(<TagInput tags={['jazz']} suggestions={['jazz']} label="Score" suggestionButtons onChange={onChange} />)
  const input = screen.getByRole('textbox', { name: 'Add tag' })
  const choice = screen.getByRole('button', { name: '#jazz' })
  fireEvent.change(input, { target: { value: 'draft' } })
  fireEvent.pointerDown(choice)
  fireEvent.blur(input)
  fireEvent.click(choice)
  expect(onChange).toHaveBeenCalledWith(['jazz', 'draft'])
})
