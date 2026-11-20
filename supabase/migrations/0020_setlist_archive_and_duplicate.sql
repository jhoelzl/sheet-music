-- Setlist archive and duplication.
--
-- archived_at keeps old setlists out of the way without deleting their tune
-- selection, placeholders and comments. null means active.
alter table public.sm_setlists add column archived_at timestamptz;

-- Copy a setlist with every entry (tunes, placeholders, comments and order) in
-- one transaction. The copy is appended to the end of the user's setlists.
create function public.sm_duplicate_setlist(source_id uuid, new_name text) returns uuid
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
  insert into public.sm_setlist_pieces (setlist_id, piece_id, position, placeholder, comment)
  select target_id, piece_id, position, placeholder, comment
  from public.sm_setlist_pieces where setlist_id = source_id;
  return target_id;
end;
$$;
