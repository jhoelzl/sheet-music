-- Existing duplicates must be resolved manually before this index can be created.
create unique index sm_composers_name_user_unique
  on public.sm_composers (user_id, lower(btrim(name)));
