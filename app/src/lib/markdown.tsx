import type { ReactNode } from 'react'

/**
 * A deliberately small markdown renderer for short user notes (setlist comments).
 * It builds React elements instead of HTML, so a comment can never inject markup.
 *
 * Supported: headings, unordered and ordered lists, blockquotes, horizontal rules,
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

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let quote: string[] = []
  let key = 0

  const flushParagraph = () => {
    if (!paragraph.length) return
    const k = `p${key++}`
    blocks.push(<p key={k}>{inlineLines(paragraph, k)}</p>)
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    const k = `l${key++}`
    const items = list.items.map((item, index) => <li key={`${k}-${index}`}>{inline(item, `${k}-${index}`)}</li>)
    blocks.push(list.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>)
    list = null
  }
  const flushQuote = () => {
    if (!quote.length) return
    const k = `q${key++}`
    blocks.push(<blockquote key={k}>{inlineLines(quote, k)}</blockquote>)
    quote = []
  }
  const flush = () => { flushParagraph(); flushList(); flushQuote() }

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
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

    const bullet = /^[-*+]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      flushParagraph(); flushQuote()
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] } }
      list.items.push((bullet ?? numbered)![1])
      continue
    }

    const quoted = /^>\s?(.*)$/.exec(line)
    if (quoted) { flushParagraph(); flushList(); quote.push(quoted[1]); continue }

    flushList(); flushQuote()
    paragraph.push(line)
  }
  flush()

  return <div className={className ? `md ${className}` : 'md'}>{blocks}</div>
}
