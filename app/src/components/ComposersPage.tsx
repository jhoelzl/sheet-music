import type { Library } from '../hooks/useLibrary'
import { safeUrl } from '../lib/links'
import { youtubeId } from '../lib/youtube'
import type { Piece } from '../supabase'
import { AddForms } from './AddForms'
import { CompactPiece } from './CompactPiece'
import { ComposerHeading } from './ComposerHeading'
import { VideoFeed } from './VideoFeed'

export function ComposersPage({ lib }: { lib: Library }) {
  const composers = lib.composers.filter((c) => !lib.hiddenIds.has(`composer:${c.id}`))

  return (
    <>
      <div className="library-intro">
        <div>
          <h2>Composers</h2>
          <p>{composers.length} {composers.length === 1 ? 'composer' : 'composers'}</p>
        </div>
        <button className={`btn primary${lib.panel === 'composer' ? ' active' : ''}`} onClick={() => lib.setPanel(lib.panel === 'composer' ? null : 'composer')}>+ Composer</button>
      </div>

      {lib.panel === 'composer' && <AddForms lib={lib} />}
      {!composers.length && <div className="empty"><h3>No composers yet</h3><p>Add your first composer to get started.</p></div>}
      <div className="composer-list">
        {composers.map((c) => {
          const pieces = lib.pieces.filter((p) => lib.composerIdsOf(p).includes(c.id) && !lib.hiddenIds.has(p.id))
          const videos = composerVideos(pieces, c.name)
          return (
            <section className="composer-section" key={c.id}>
              <ComposerHeading lib={lib} composer={c} countLabel={`${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}`} />
              <details className="composer-explorer">
                <summary className="composer-explorer-toggle">
                  <span>Show pieces and videos</span>
                  <span>{pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'} · {videos.length} {videos.length === 1 ? 'video' : 'videos'}</span>
                </summary>
                <div className="composer-explorer-content">
                  <section>
                    <h4>Pieces</h4>
                    {pieces.length
                      ? <div className="focus-list">{pieces.map((p) => <CompactPiece key={p.id} lib={lib} p={p} />)}</div>
                      : <p className="muted">No pieces for this composer yet.</p>}
                  </section>
                  <section>
                    <h4>Videos</h4>
                    {videos.length
                      ? <VideoFeed videos={videos} />
                      : <p className="muted">No YouTube videos linked to this composer’s pieces yet.</p>}
                  </section>
                </div>
              </details>
            </section>
          )
        })}
      </div>
    </>
  )
}

function composerVideos(pieces: Piece[], composer: string) {
  return pieces.flatMap((piece) => (piece.links ?? []).flatMap((link) => {
    const href = safeUrl(link.url)
    const id = href && youtubeId(href)
    return href && id ? [{ key: `${piece.id}:${id}`, id, href, title: piece.title, composer }] : []
  }))
}
