-- Pieces can have any number of links (YouTube, Spotify, Instagram or other).
-- Each entry: {"type": "youtube" | "spotify" | "instagram" | "other", "url": "https://..."}
alter table sm_pieces add column if not exists links jsonb not null default '[]'::jsonb;

-- Migrate the former single youtube_url / spotify_url columns (only for rows not migrated yet).
update sm_pieces
set links =
  case when nullif(trim(youtube_url), '') is not null
    then jsonb_build_array(jsonb_build_object('type', 'youtube', 'url', trim(youtube_url)))
    else '[]'::jsonb end
  ||
  case when nullif(trim(spotify_url), '') is not null
    then jsonb_build_array(jsonb_build_object('type', 'spotify', 'url', trim(spotify_url)))
    else '[]'::jsonb end
where links = '[]'::jsonb
  and (nullif(trim(youtube_url), '') is not null or nullif(trim(spotify_url), '') is not null);

-- The old columns are dropped in 0009_drop_legacy_link_columns.sql.
