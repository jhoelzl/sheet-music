alter table public.sm_setlists add column position integer not null default 0;

with ordered as (
  select id, row_number() over (partition by user_id order by created_at, id) - 1 as position
  from public.sm_setlists
)
update public.sm_setlists s set position = ordered.position
from ordered where ordered.id = s.id;

alter table public.sm_setlist_pieces
  drop constraint sm_setlist_pieces_pkey,
  alter column piece_id drop not null,
  add column id uuid not null default gen_random_uuid(),
  add column placeholder text,
  add column comment text,
  add primary key (id),
  add constraint sm_setlist_pieces_unique_piece unique (setlist_id, piece_id),
  add constraint sm_setlist_pieces_entry_check check (
    (piece_id is not null and placeholder is null)
    or (piece_id is null and placeholder is not null and length(trim(placeholder)) > 0)
  );

drop policy "own setlist pieces" on public.sm_setlist_pieces;
create policy "own setlist pieces" on public.sm_setlist_pieces for all
  using (
    exists (select 1 from public.sm_setlists s where s.id = setlist_id)
    and (piece_id is null or exists (select 1 from public.sm_pieces p where p.id = piece_id))
  )
  with check (
    exists (select 1 from public.sm_setlists s where s.id = setlist_id)
    and (piece_id is null or exists (select 1 from public.sm_pieces p where p.id = piece_id))
  );

create function public.sm_swap_setlists(first_id uuid, second_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare
  first_position integer;
  second_position integer;
begin
  if first_id = second_id then raise exception 'Setlists must be different'; end if;
  select position into first_position from sm_setlists where id = first_id for update;
  if not found then raise exception 'Setlist not found'; end if;
  select position into second_position from sm_setlists where id = second_id for update;
  if not found then raise exception 'Setlist not found'; end if;
  update sm_setlists set position = case when id = first_id then second_position else first_position end
    where id in (first_id, second_id);
end;
$$;

create function public.sm_swap_setlist_entries(list_id uuid, first_id uuid, second_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare
  first_position integer;
  second_position integer;
begin
  if first_id = second_id then raise exception 'Entries must be different'; end if;
  select position into first_position from sm_setlist_pieces where id = first_id and setlist_id = list_id for update;
  if not found then raise exception 'Setlist entry not found'; end if;
  select position into second_position from sm_setlist_pieces where id = second_id and setlist_id = list_id for update;
  if not found then raise exception 'Setlist entry not found'; end if;
  update sm_setlist_pieces set position = case when id = first_id then second_position else first_position end
    where setlist_id = list_id and id in (first_id, second_id);
end;
$$;
