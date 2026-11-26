import { useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'

type VideoDetails = { key: string; href: string; title: string; composer: string }
export type Video = VideoDetails & (
  | { platform: 'youtube'; id: string }
  | { platform: 'instagram' }
)

const YouTubePlayer = registerPlugin<{ open(options: { videoId: string; title: string }): Promise<void> }>('YouTubePlayer')

export function VideoFeed({ videos }: { videos: Video[] }) {
  const [playing, setPlaying] = useState<string | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)

  const playVideo = async (video: Video) => {
    if (video.platform !== 'youtube') return
    setPlayerError(null)
    if (Capacitor.getPlatform() !== 'ios') {
      setPlaying(video.key)
      return
    }
    try {
      await YouTubePlayer.open({ videoId: video.id, title: video.title })
    } catch (error) {
      console.error('Unable to open the YouTube player', error)
      setPlayerError(video.key)
    }
  }

  return (
    <div className="video-feed">
      {videos.map((v) => (
        <article className="video-card" key={v.key}>
          <div className="video-meta">
            <span className="video-avatar" aria-hidden="true">{Array.from(v.composer.trim())[0]?.toLocaleUpperCase() ?? '♪'}</span>
            <div className="video-details">
              <strong>{v.title}</strong>
              <span>{v.composer || 'Unknown composer'}</span>
            </div>
            <a className="video-source" href={v.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${v.title} on ${v.platform === 'youtube' ? 'YouTube' : 'Instagram'}`}>{v.platform === 'youtube' ? 'YouTube' : 'Instagram'} <span aria-hidden="true">↗</span></a>
          </div>
          <div className="video-media">
            {v.platform === 'instagram' ? (
              <a className="video-instagram-link" href={v.href} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${v.title} on Instagram`}>
                <span className="video-instagram-icon" aria-hidden="true">◎</span>
                <strong>Watch on Instagram</strong>
                <span aria-hidden="true">↗</span>
              </a>
            ) : playing === v.key ? (
              <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            ) : (
              <button type="button" className="video-thumb" aria-label={`Play ${v.title}`} onClick={() => void playVideo(v)}>
                <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" />
                <span className="video-play" aria-hidden="true">▶</span>
              </button>
            )}
          </div>
          {playerError === v.key && <p className="video-error" role="alert">Could not open the video player. Use the YouTube link above to watch.</p>}
        </article>
      ))}
    </div>
  )
}
