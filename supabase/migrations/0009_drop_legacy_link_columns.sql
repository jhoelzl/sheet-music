-- Links now live in sm_pieces.links (see 0008); remove the legacy single-link columns and their data.
alter table sm_pieces drop column if exists youtube_url, drop column if exists spotify_url;
