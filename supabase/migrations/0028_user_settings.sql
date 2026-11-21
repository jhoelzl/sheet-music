begin;

create table public.sm_user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  library_view text not null default 'remember' check (library_view in ('remember', 'list', 'grouped', 'table', 'grid', 'board')),
  library_sort text not null default 'title' check (library_sort in ('title', 'rating', 'difficulty', 'recent')),
  library_filter text not null default 'all' check (library_filter in ('all', 'can_play', 'learned', 'cannot_play', 'hard')),
  library_instrument text not null default 'all' check (library_instrument in ('all', 'piano', 'guitar')),
  video_order text not null default 'original' check (video_order in ('original', 'random'))
);

alter table public.sm_user_settings enable row level security;
revoke all on public.sm_user_settings from anon, authenticated;
grant select, insert, update, delete on public.sm_user_settings to authenticated;
create policy "own user settings" on public.sm_user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
