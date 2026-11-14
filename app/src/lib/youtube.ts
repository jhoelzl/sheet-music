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
