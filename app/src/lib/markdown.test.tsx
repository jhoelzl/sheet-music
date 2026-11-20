import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown } from './markdown'

describe('markdown renderer', () => {
  it('renders bold, italic and inline code', () => {
    render(<Markdown text="**bold** and *italic* and `code`" />)
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('italic').tagName).toBe('EM')
    expect(screen.getByText('code').tagName).toBe('CODE')
  })

  it('keeps single newlines as breaks and blank lines as separate paragraphs', () => {
    const { container } = render(<Markdown text={'one\ntwo\n\nthree'} />)
    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelector('p')?.querySelector('br')).toBeTruthy()
  })

  it('renders headings, lists, blockquotes and rules', () => {
    const { container } = render(<Markdown text={'# Title\n\n- a\n- b\n\n1. one\n2. two\n\n> note\n\n---'} />)
    expect(container.querySelector('h3')?.textContent).toBe('Title')
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
    expect(container.querySelector('blockquote')?.textContent).toBe('note')
    expect(container.querySelector('hr')).toBeTruthy()
  })

  it('links only safe targets', () => {
    const { container } = render(<Markdown text={'[docs](https://example.com) and [bad](javascript:alert)'} />)
    const link = screen.getByText('docs')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('https://example.com')
    expect(link.getAttribute('rel')).toContain('noreferrer')
    // An unsafe target stays as plain text instead of becoming a link.
    expect(container.querySelectorAll('a')).toHaveLength(1)
    expect(container.textContent).toContain('[bad](javascript:alert)')
  })

  it('does not turn raw HTML into elements', () => {
    const { container } = render(<Markdown text={'<img src=x onerror="boom()">'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror="boom()">')).toBeTruthy()
  })
})
