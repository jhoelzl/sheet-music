create table public.sm_piece_composers (
  piece_id uuid not null references public.sm_pieces(id) on delete cascade,
  composer_id uuid not null references public.sm_composers(id) on delete cascade,
  position integer not null default 0,
  primary key (piece_id, composer_id)
);

insert into public.sm_piece_composers (piece_id, composer_id, position)
select id, composer_id, 0
from public.sm_pieces;

alter table public.sm_piece_composers enable row level security;
create policy "own piece composer links" on public.sm_piece_composers for all
  using (
    exists (select 1 from public.sm_pieces p where p.id = piece_id)
    and exists (select 1 from public.sm_composers c where c.id = composer_id)
  )
  with check (
    exists (select 1 from public.sm_pieces p where p.id = piece_id)
    and exists (select 1 from public.sm_composers c where c.id = composer_id)
  );

create table public.sm_setlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.sm_setlists enable row level security;
create policy "own setlists" on public.sm_setlists for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.sm_setlist_pieces (
  setlist_id uuid not null references public.sm_setlists(id) on delete cascade,
  piece_id uuid not null references public.sm_pieces(id) on delete cascade,
  position integer not null default 0,
  primary key (setlist_id, piece_id)
);

create index sm_setlist_pieces_piece_id_idx on public.sm_setlist_pieces (piece_id);

alter table public.sm_setlist_pieces enable row level security;
create policy "own setlist pieces" on public.sm_setlist_pieces for all
  using (
    exists (select 1 from public.sm_setlists s where s.id = setlist_id)
    and exists (select 1 from public.sm_pieces p where p.id = piece_id)
  )
  with check (
    exists (select 1 from public.sm_setlists s where s.id = setlist_id)
    and exists (select 1 from public.sm_pieces p where p.id = piece_id)
  );
