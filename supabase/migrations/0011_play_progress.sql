-- Replace the can_play / learned / learn_later booleans with one granular progress value.
alter table sm_pieces
  add column play_progress smallint not null default 0
  check (play_progress in (0, 25, 50, 75, 100));

update sm_pieces set play_progress = case
  when can_play then 100
  when learned then 50
  else 0
end;

alter table sm_pieces drop column can_play, drop column learned, drop column learn_later;
