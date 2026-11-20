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

  it('keeps lesson sublists under the correct parent items', () => {
    const text = [
      '- Alter Band C-Dur / G-Dur Akkord Übungen machen',
      '- Chromatische Treppen Übungen',
      '    - Auf 9. Bund beginnen',
      '    - Wenn 5 Noten, dann muss man nicht weiter greifen',
      '    - Wenn nur 3 Noten dann muss man wieder greifen',
      '- Zweistimmige Übungen',
      '- Vaya con dios - Nah neh nah',
      '    - Melodie und Akkorde weiterüben',
    ].join('\n')
    const { container } = render(<Markdown text={text} />)
    const root = container.querySelector(':scope > .md > ul')!
    expect(root.children).toHaveLength(4)
    expect(root.children[1].querySelectorAll(':scope > ul > li')).toHaveLength(3)
    expect(root.children[1].querySelector('ul')?.textContent).toContain('Auf 9. Bund beginnen')
    expect(root.children[3].querySelector(':scope > ul > li')?.textContent).toBe('Melodie und Akkorde weiterüben')
  })

  it('renders mixed, deeply nested and separately numbered lists', () => {
    const { container } = render(<Markdown text={'3. Start\n   - **First**\n     1. Inner\n     2. Next\n   - Second\n4. Finish\n\n- Separate\n\t- Tabbed'} />)
    const ordered = container.querySelector('.md > ol')!
    expect(ordered.getAttribute('start')).toBe('3')
    expect(ordered.children).toHaveLength(2)
    expect(ordered.children[0].querySelectorAll(':scope > ul > li')).toHaveLength(2)
    expect(ordered.children[0].querySelectorAll('ul > li > ol > li')).toHaveLength(2)
    expect(ordered.querySelector('strong')?.textContent).toBe('First')
    const separate = container.querySelector('.md > ul')!
    expect(separate.querySelector(':scope > li > ul > li')?.textContent).toBe('Tabbed')
  })

  it('keeps nested lists together across blank lines without consuming following paragraphs', () => {
    const { container } = render(<Markdown text={'- Parent\n\n  - Child\n\n- Next\n\nAfterwards'} />)
    expect(container.querySelectorAll('.md > ul > li')).toHaveLength(2)
    expect(container.querySelector('.md > ul > li > ul > li')?.textContent).toBe('Child')
    expect(container.querySelector('.md > p')?.textContent).toBe('Afterwards')
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
