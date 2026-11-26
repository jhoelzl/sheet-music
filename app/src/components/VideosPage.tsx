import { useEffect, useMemo, useState } from 'react'
import { useUrlString } from '../hooks/useUrlState'
import { supabase } from '../supabase'
import type { Composer, Piece } from '../supabase'
import { detectLinkType, safeUrl } from '../lib/links'
import { youtubeId } from '../lib/youtube'
import { VideoFeed } from './VideoFeed'
import type { Video } from './VideoFeed'

type SortableVideo = Video & { addedAt: number | null; lastPractised: number | null }

export function VideosPage({ defaultRandom = false }: { defaultRandom?: boolean }) {
  const [videos, setVideos] = useState<SortableVideo[] | null>(null)
  const [defaultOrder] = useState(() => defaultRandom ? `random:${randomSeed()}` : 'ordered')
  const [order, setOrder] = useUrlString('videoOrder', defaultOrder)
  const [error, setError] = useState('')
  const seedMatch = /^random:(\d{1,10})$/.exec(order)
  const seed = seedMatch && Number(seedMatch[1]) <= 0xffffffff ? Number(seedMatch[1]) : null
  const selectedOrder = seed !== null ? 'random' : order === 'added' || order === 'practised' ? order : 'ordered'
  const orderedVideos = useMemo(() => {
    if (!videos) return null
    if (seed !== null) return shuffle(videos, seed)
    if (selectedOrder === 'added' || selectedOrder === 'practised') {
      const field = selectedOrder === 'added' ? 'addedAt' : 'lastPractised'
      return [...videos].sort((a, b) => {
        const first = a[field], second = b[field]
        if (first === null) return second === null ? 0 : 1
        if (second === null) return -1
        return second - first
      })
    }
    return videos
  }, [videos, seed, selectedOrder])

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('videoOrder')) setOrder(defaultOrder)
  }, [defaultOrder, setOrder])

  useEffect(() => {
    void (async () => {
      const [c, p, pc] = await Promise.all([
        supabase.from('sm_composers').select('*'),
        supabase.from('sm_pieces').select('*').order('title'),
        supabase.from('sm_piece_composers').select('piece_id, composer_id, position').order('position'),
      ])
      if (c.error || p.error || pc.error) { setError((c.error ?? p.error ?? pc.error)!.message); return }
      const names = new Map((c.data as Composer[]).map((x) => [x.id, x.name]))
      const composerIdsByPiece = new Map<string, string[]>()
      for (const link of pc.data ?? []) {
        const ids = composerIdsByPiece.get(link.piece_id) ?? []
        ids.push(link.composer_id)
        composerIdsByPiece.set(link.piece_id, ids)
      }
      const out: SortableVideo[] = []
      for (const piece of p.data as Piece[]) {
        const composerNames = [...new Set([piece.composer_id, ...(composerIdsByPiece.get(piece.id) ?? [])])]
          .map((id) => names.get(id))
          .filter(Boolean)
          .join(', ')
        for (const [index, link] of (piece.links ?? []).entries()) {
          const href = safeUrl(link.url)
          if (!href) continue
          const video = {
            key: `${piece.id}:${index}:${href}`, href, title: piece.title, composer: composerNames,
            addedAt: timestamp(link.added_at), lastPractised: timestamp(piece.last_practiced),
          }
          const id = youtubeId(href)
          if (id) out.push({ ...video, platform: 'youtube', id })
          else if (detectLinkType(href) === 'instagram') out.push({ ...video, platform: 'instagram' })
        }
      }
      setVideos(out)
    })()
  }, [])

  if (error) return <div className="empty"><h3>Could not load videos</h3><p>{error}</p></div>
  if (!videos) return <p>Loading…</p>
  if (!videos.length) return <div className="empty"><h3>No videos yet</h3><p>Add a YouTube or Instagram link to a piece to see it here.</p></div>
  return (
    <>
      <div className="library-intro video-intro"><div><h2>Videos</h2><p>{videos.length} {videos.length === 1 ? 'video' : 'videos'} from your library</p></div></div>
      {videos.length > 1 && <div className="video-order" aria-label="Video order">
        <label className="sort-field">Sort by
          <select value={selectedOrder} onChange={(event) => setOrder(event.target.value === 'random' ? `random:${randomSeed()}` : event.target.value)}>
            <option value="ordered">Library order</option>
            <option value="added">Recently added</option>
            <option value="practised">Last practised (recent first)</option>
            <option value="random">Random order</option>
          </select>
        </label>
        {seed !== null && <button type="button" className="btn" onClick={() => setOrder(`random:${randomSeed()}`)}>Shuffle again</button>}
        {selectedOrder === 'added' && videos.some((video) => video.addedAt === null) &&
          <p className="video-order-hint">Older links without a recorded date appear last.</p>}
      </div>}
      <VideoFeed videos={orderedVideos ?? videos} />
    </>
  )
}

function randomSeed() {
  return Math.floor(Math.random() * 0x100000000)
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function shuffle<T>(videos: T[], seed: number): T[] {
  const result = [...videos]
  let state = seed
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = Math.floor((state / 0x100000000) * (i + 1))
    const current = result[i]
    result[i] = result[j]
    result[j] = current
  }
  return result
}
