alter table sm_pieces
  add column instruments text[] not null default '{piano}'
  check (cardinality(instruments) > 0 and instruments <@ array['piano', 'guitar']);
