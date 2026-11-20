import type { ReactNode } from 'react'

/**
 * A deliberately small markdown renderer for short user notes (setlist comments).
 * It builds React elements instead of HTML, so a comment can never inject markup.
 *
 * Supported: headings, nested unordered and ordered lists, blockquotes, horizontal rules,
 * paragraphs, hard line breaks, **bold**, *italic*, `code` and [links](https://…).
 */

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]\n]+\]\([^)\s]+\))/

const HEADINGS = ['h3', 'h4', 'h5', 'h6'] as const

/** Keep link targets harmless: absolute http(s)/mailto, or a relative path or anchor. */
function safeHref(url: string): string | null {
  const trimmed = url.trim()
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed
  if (/^[/#][^\s]*$/.test(trimmed)) return trimmed
  return null
}

/** Turn one line of text into text nodes and inline elements. */
function inline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let rest = text
  let index = 0
  while (rest) {
    const match = INLINE.exec(rest)
    if (!match || match.index === undefined) break
    if (match.index > 0) nodes.push(rest.slice(0, match.index))
    const token = match[0]
    const tokenKey = `${key}.${index++}`
    if (token.startsWith('`')) {
      nodes.push(<code key={tokenKey}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={tokenKey}>{inline(token.slice(2, -2), tokenKey)}</strong>)
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(<em key={tokenKey}>{inline(token.slice(1, -1), tokenKey)}</em>)
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      const href = link ? safeHref(link[2]) : null
      nodes.push(link && href
        ? <a key={tokenKey} href={href} target="_blank" rel="noreferrer noopener">{inline(link[1], tokenKey)}</a>
        : token)
    }
    rest = rest.slice(match.index + token.length)
  }
  if (rest) nodes.push(rest)
  return nodes
}

/** Join the lines of a paragraph or blockquote, keeping single newlines as breaks. */
function inlineLines(lines: string[], key: string): ReactNode[] {
  const nodes: ReactNode[] = []
  lines.forEach((line, index) => {
    if (index) nodes.push(<br key={`${key}-br${index}`} />)
    nodes.push(...inline(line, `${key}-${index}`))
  })
  return nodes
}

type ListMarker = { indent: number; ordered: boolean; start: number; text: string }

function listMarker(line: string): ListMarker | null {
  const match = /^([ \t]*)(?:([-*+])|(\d+)[.)])[ \t]+(.*)$/.exec(line)
  if (!match) return null
  const indent = [...match[1]].reduce((column, char) => char === '\t' ? column + 4 - column % 4 : column + 1, 0)
  return { indent, ordered: Boolean(match[3]), start: Number(match[3] ?? 1), text: match[4] }
}

function parseList(lines: string[], startIndex: number, key: string): { node: ReactNode; next: number } {
  const first = listMarker(lines[startIndex])!
  const items: { text: string; children: ReactNode[] }[] = []
  let index = startIndex
  while (index < lines.length) {
    if (!lines[index].trim()) {
      let next = index + 1
      while (next < lines.length && !lines[next].trim()) next++
      const marker = next < lines.length ? listMarker(lines[next]) : null
      if (!marker || marker.indent < first.indent) break
      index = next
    }
    const marker = listMarker(lines[index])
    if (!marker || marker.indent < first.indent) break
    if (marker.indent > first.indent) {
      const item = items[items.length - 1]
      const child = parseList(lines, index, `${key}-${items.length}-${item.children.length}`)
      item.children.push(child.node)
      index = child.next
      continue
    }
    if (marker.ordered !== first.ordered) break
    items.push({ text: marker.text, children: [] })
    index++
  }
  const children = items.map((item, i) => <li key={`${key}-${i}`}>{inline(item.text, `${key}-${i}`)}{item.children}</li>)
  return {
    node: first.ordered ? <ol key={key} start={first.start}>{children}</ol> : <ul key={key}>{children}</ul>,
    next: index,
  }
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let quote: string[] = []
  let key = 0

  const flushParagraph = () => {
    if (!paragraph.length) return
    const k = `p${key++}`
    blocks.push(<p key={k}>{inlineLines(paragraph, k)}</p>)
    paragraph = []
  }
  const flushQuote = () => {
    if (!quote.length) return
    const k = `q${key++}`
    blocks.push(<blockquote key={k}>{inlineLines(quote, k)}</blockquote>)
    quote = []
  }
  const flush = () => { flushParagraph(); flushQuote() }

  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]
    const line = raw.trim()
    if (!line) { flush(); continue }

    const head = /^(#{1,6})\s+(.*)$/.exec(line)
    if (head) {
      flush()
      const k = `h${key++}`
      const Tag = HEADINGS[Math.min(head[1].length - 1, HEADINGS.length - 1)]
      blocks.push(<Tag key={k}>{inline(head[2], k)}</Tag>)
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); blocks.push(<hr key={`hr${key++}`} />); continue }

    if (listMarker(raw)) {
      flushParagraph(); flushQuote()
      const parsed = parseList(lines, index, `l${key++}`)
      blocks.push(parsed.node)
      index = parsed.next - 1
      continue
    }

    const quoted = /^>\s?(.*)$/.exec(line)
    if (quoted) { flushParagraph(); quote.push(quoted[1]); continue }

    flushQuote()
    paragraph.push(line)
  }
  flush()

  return <div className={className ? `md ${className}` : 'md'}>{blocks}</div>
}
