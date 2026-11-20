-- Pre-select which of a tune's scores a setlist entry uses, e.g. the guitar
-- arrangement instead of the piano score. null means the piece's first score.
alter table public.sm_setlist_pieces
  add column score_id uuid references public.sm_piece_scores(id) on delete set null;

-- Keep score_id pointing at a score of the same piece.
create function public.sm_setlist_pieces_score_check() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.score_id is not null and not exists (
    select 1 from public.sm_piece_scores s
    where s.id = new.score_id and s.piece_id = new.piece_id
  ) then
    raise exception 'The chosen score does not belong to this piece';
  end if;
  return new;
end;
$$;

create trigger sm_setlist_pieces_score_check
  before insert or update of score_id, piece_id on public.sm_setlist_pieces
  for each row execute function public.sm_setlist_pieces_score_check();

-- Duplication copies the pre-selected score too.
create or replace function public.sm_duplicate_setlist(source_id uuid, new_name text) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  target_id uuid;
  next_position integer;
begin
  if new_name is null or length(trim(new_name)) = 0 then
    raise exception 'A setlist name is required';
  end if;
  perform 1 from public.sm_setlists where id = source_id for update;
  if not found then raise exception 'Setlist not found'; end if;
  select coalesce(max(position), -1) + 1 into next_position
  from public.sm_setlists where user_id = auth.uid();
  insert into public.sm_setlists (name, position) values (trim(new_name), next_position)
  returning id into target_id;
  insert into public.sm_setlist_pieces (setlist_id, piece_id, position, placeholder, comment, score_id)
  select target_id, piece_id, position, placeholder, comment, score_id
  from public.sm_setlist_pieces where setlist_id = source_id;
  return target_id;
end;
$$;
