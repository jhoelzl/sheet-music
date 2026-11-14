import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Composer, Piece } from '../supabase'
import { safeUrl } from '../lib/links'
import { youtubeId } from '../lib/youtube'
import { VideoFeed } from './VideoFeed'
import type { Video } from './VideoFeed'

export function VideosPage() {
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [error, setError] = useState('')

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
      <div className="library-intro video-intro"><div><span className="library-kicker">Your music</span><h2>Videos</h2><p>{videos.length} {videos.length === 1 ? 'video' : 'videos'} from your library</p></div></div>
      <VideoFeed videos={videos} />
    </>
  )
}
