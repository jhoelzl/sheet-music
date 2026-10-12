-- The favorite flag was replaced by play_progress and is no longer read by the app.
alter table sm_pieces drop column if exists favorite;
