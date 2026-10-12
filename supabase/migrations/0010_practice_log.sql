-- One row per piece per day practiced; powers the practice calendar.
create table if not exists sm_practice_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  piece_id uuid not null references sm_pieces(id) on delete cascade,
  practiced_on date not null default current_date,
  unique (piece_id, practiced_on)
);

create index if not exists sm_practice_log_user_day_idx on sm_practice_log (user_id, practiced_on);

alter table sm_practice_log enable row level security;

drop policy if exists "own practice log" on sm_practice_log;
create policy "own practice log" on sm_practice_log
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Backfill from the existing single "last practiced" date.
insert into sm_practice_log (user_id, piece_id, practiced_on)
select user_id, id, last_practiced from sm_pieces where last_practiced is not null
on conflict do nothing;
