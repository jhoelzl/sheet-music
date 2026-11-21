-- Preserve the old fields for clients that are still open during deployment.
begin;

alter table public.sm_piece_scores add column tags text[];

update public.sm_piece_scores
set tags = array_remove(array[instrument, case when lead_sheet then 'lead sheet' end], null);

alter table public.sm_piece_scores
  alter column tags set not null,
  drop constraint sm_piece_scores_lead_sheet_check;

create function public.sm_sync_score_tags() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.tags is null then
    new.tags := array_remove(array[new.instrument, case when new.lead_sheet then 'lead sheet' end], null);
  elsif tg_op = 'UPDATE' and new.tags is not distinct from old.tags
    and (new.instrument is distinct from old.instrument or new.lead_sheet is distinct from old.lead_sheet) then
    new.tags := array_remove(array_remove(array_remove(new.tags, 'piano'), 'guitar'), 'lead sheet')
      || array_remove(array[new.instrument, case when new.lead_sheet then 'lead sheet' end], null);
  end if;

  new.instrument := case when 'piano' = any(new.tags) then 'piano'
    when 'guitar' = any(new.tags) then 'guitar' else null end;
  new.lead_sheet := 'lead sheet' = any(new.tags);
  return new;
end;
$$;

create trigger sm_piece_scores_sync_tags
before insert or update on public.sm_piece_scores
for each row execute function public.sm_sync_score_tags();

commit;
