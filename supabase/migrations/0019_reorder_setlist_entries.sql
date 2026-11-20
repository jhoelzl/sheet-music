-- Drag-and-drop reordering of setlist tunes: move an entry to a new slot and
-- renumber every entry of the setlist in one transaction. The full ordered list
-- is sent so gaps left by earlier deletions are collapsed at the same time.
create function public.sm_reorder_setlist_entries(list_id uuid, entry_ids uuid[]) returns void
language plpgsql security invoker set search_path = public as $$
declare
  expected integer;
begin
  select count(*) into expected from public.sm_setlist_pieces where setlist_id = list_id;
  if expected <> coalesce(array_length(entry_ids, 1), 0) then
    raise exception 'The provided order does not match the setlist entries';
  end if;
  if exists (
    select 1
    from unnest(entry_ids) as provided(id)
    left join public.sm_setlist_pieces item
      on item.id = provided.id and item.setlist_id = list_id
    where item.id is null
  ) then
    raise exception 'Setlist entry not found';
  end if;
  perform 1 from public.sm_setlist_pieces where setlist_id = list_id for update;
  update public.sm_setlist_pieces item
  set position = (ordered.ordinality - 1)::integer
  from unnest(entry_ids) with ordinality as ordered(id, ordinality)
  where item.id = ordered.id and item.setlist_id = list_id;
end;
$$;
