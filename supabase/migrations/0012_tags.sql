-- Free-form tags per piece (e.g. "recital", "etude"). Stored lowercase, trimmed and de-duplicated by the app.
alter table sm_pieces add column if not exists tags text[] not null default '{}';

alter table sm_pieces drop constraint if exists sm_pieces_tags_check;
alter table sm_pieces add constraint sm_pieces_tags_check
  check (cardinality(tags) <= 20);

create index if not exists sm_pieces_tags_idx on sm_pieces using gin (tags);
