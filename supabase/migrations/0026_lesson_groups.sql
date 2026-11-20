create table public.sm_lesson_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  teacher_name text not null check (length(trim(teacher_name)) > 0),
  instrument text not null check (instrument in ('guitar', 'piano')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

alter table public.sm_lesson_groups enable row level security;
create policy "own lesson groups" on public.sm_lesson_groups for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.sm_lessons add column group_id uuid;
alter table public.sm_lessons add constraint sm_lessons_group_owner_fkey
  foreign key (group_id, user_id) references public.sm_lesson_groups (id, user_id);
create index on public.sm_lessons (group_id);
