create table public.sm_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_date date not null,
  title text not null check (length(trim(title)) > 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.sm_teaching_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  pdf_path text not null,
  created_at timestamptz not null default now()
);

create table public.sm_lesson_pieces (
  lesson_id uuid not null references public.sm_lessons(id) on delete cascade,
  piece_id uuid not null references public.sm_pieces(id) on delete cascade,
  primary key (lesson_id, piece_id)
);

create table public.sm_lesson_materials (
  lesson_id uuid not null references public.sm_lessons(id) on delete cascade,
  material_id uuid not null references public.sm_teaching_materials(id) on delete cascade,
  primary key (lesson_id, material_id)
);

create index on public.sm_lesson_pieces (piece_id);
create index on public.sm_lesson_materials (material_id);

alter table public.sm_lessons enable row level security;
alter table public.sm_teaching_materials enable row level security;
alter table public.sm_lesson_pieces enable row level security;
alter table public.sm_lesson_materials enable row level security;

create policy "own lessons" on public.sm_lessons for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own teaching materials" on public.sm_teaching_materials for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own lesson pieces" on public.sm_lesson_pieces for all
  using (exists (select 1 from public.sm_lessons l where l.id = lesson_id and l.user_id = auth.uid())
    and exists (select 1 from public.sm_pieces p where p.id = piece_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.sm_lessons l where l.id = lesson_id and l.user_id = auth.uid())
    and exists (select 1 from public.sm_pieces p where p.id = piece_id and p.user_id = auth.uid()));
create policy "own lesson materials" on public.sm_lesson_materials for all
  using (exists (select 1 from public.sm_lessons l where l.id = lesson_id and l.user_id = auth.uid())
    and exists (select 1 from public.sm_teaching_materials m where m.id = material_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.sm_lessons l where l.id = lesson_id and l.user_id = auth.uid())
    and exists (select 1 from public.sm_teaching_materials m where m.id = material_id and m.user_id = auth.uid()));
