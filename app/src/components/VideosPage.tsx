import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Composer, Piece } from '../supabase'
import { safeUrl } from '../lib/links'

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^(www|m|music)\./, '')
    let id: string | null = null
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0]
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)
      id = u.pathname === '/watch' ? u.searchParams.get('v') : m ? m[1] : null
    }
    return id && /^[\w-]{6,}$/.test(id) ? id : null
  } catch {
    return null
  }
}

type Video = { key: string; id: string; href: string; title: string; composer: string }

export function VideosPage() {
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [c, p] = await Promise.all([
        supabase.from('sm_composers').select('*'),
        supabase.from('sm_pieces').select('*').order('title'),
      ])
      if (c.error || p.error) { setError((c.error ?? p.error)!.message); return }
      const names = new Map((c.data as Composer[]).map((x) => [x.id, x.name]))
      const out: Video[] = []
      for (const piece of p.data as Piece[]) {
        for (const link of piece.links ?? []) {
          const href = safeUrl(link.url)
          const id = href && youtubeId(href)
          if (href && id) out.push({ key: `${piece.id}:${id}`, id, href, title: piece.title, composer: names.get(piece.composer_id) ?? '' })
        }
      }
      setVideos(out)
    })()
  }, [])

  if (error) return <div className="empty"><h3>Could not load videos</h3><p>{error}</p></div>
  if (!videos) return <p>Loading…</p>
  if (!videos.length) return <div className="empty"><h3>No videos yet</h3><p>Add a YouTube link to a piece to see it here.</p></div>
  return (
    <>
      <div className="library-intro"><div><h2>Videos</h2><p>{videos.length} {videos.length === 1 ? 'video' : 'videos'}</p></div></div>
      <div className="video-feed">
        {videos.map((v) => (
          <article className="video-card" key={v.key}>
            <div className="video-media">
              {playing === v.key ? (
                <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
              ) : (
                <button type="button" className="video-thumb" aria-label={`Play ${v.title}`} onClick={() => setPlaying(v.key)}>
                  <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" />
                  <span className="video-play" aria-hidden="true">▶</span>
                </button>
              )}
            </div>
            <div className="video-meta">
              <strong>{v.title}</strong>
              <span>{v.composer} · <a href={v.href} target="_blank" rel="noopener noreferrer">YouTube</a></span>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
