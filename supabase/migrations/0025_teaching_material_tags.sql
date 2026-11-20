alter table public.sm_teaching_materials
  add column tags text[] not null default '{}';

alter table public.sm_teaching_materials
  add constraint sm_teaching_materials_tags_check check (cardinality(tags) <= 20);

create index sm_teaching_materials_tags_idx on public.sm_teaching_materials using gin (tags);
