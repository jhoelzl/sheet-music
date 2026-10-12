/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import type { LinkType, PieceLink } from '../supabase'
import { brandIcon, strokeIcon } from '../components/icons'

// Only http(s) links are allowed; bare hosts get https:// prepended.
export function safeUrl(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(candidate)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

export const LINK_TYPES: Record<LinkType, { label: string; glyph: ReactNode }> = {
  youtube: { label: 'YouTube', glyph: brandIcon('M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z') },
  spotify: { label: 'Spotify', glyph: brandIcon('M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z') },
  instagram: {
    label: 'Instagram',
    glyph: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></svg>
    ),
  },
  other: {
    label: 'Link',
    glyph: strokeIcon('M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5'),
  },
}

export function detectLinkType(url: string): LinkType {
  const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  const is = (d: string) => host === d || host.endsWith(`.${d}`)
  if (is('youtube.com') || is('youtu.be')) return 'youtube'
  if (is('spotify.com') || is('spotify.link')) return 'spotify'
  if (is('instagram.com') || is('instagr.am')) return 'instagram'
  return 'other'
}

// Short label for a link chip; same-type links are numbered, other links show their host.
export function linkLabel(link: PieceLink, links: PieceLink[]): string {
  if (link.type === 'other') {
    try { return new URL(link.url).hostname.replace(/^www\./, '') } catch { return LINK_TYPES.other.label }
  }
  const same = links.filter((l) => l.type === link.type)
  const base = LINK_TYPES[link.type].label
  return same.length > 1 ? `${base} ${same.indexOf(link) + 1}` : base
}
