-- A score can be a lead sheet: chords only, with no particular instrument.
-- `instrument` becomes optional and is null exactly for a lead sheet.
alter table public.sm_piece_scores
  add column lead_sheet boolean not null default false,
  alter column instrument drop not null;

alter table public.sm_piece_scores
  add constraint sm_piece_scores_lead_sheet_check
  check ((lead_sheet and instrument is null) or (not lead_sheet and instrument is not null));
