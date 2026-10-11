create table composers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  born_year int,
  died_year int,
  notes text,
  created_at timestamptz not null default now()
);

create table pieces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  composer_id uuid not null references composers(id) on delete cascade,
  title text not null,
  pdf_path text,
  can_play boolean not null default false,
  learned boolean not null default false,
  favorite boolean not null default false,
  difficulty int check (difficulty between 1 and 5),
  rating int check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create index on pieces (composer_id);

alter table composers enable row level security;
alter table pieces enable row level security;
create policy "own composers" on composers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own pieces" on pieces for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('sheet-music', 'sheet-music', false);
create policy "own pdfs" on storage.objects for all
  using (bucket_id = 'sheet-music' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'sheet-music' and (storage.foldername(name))[1] = auth.uid()::text);
