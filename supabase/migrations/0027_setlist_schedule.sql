-- Store the local date and optional time without imposing a time zone.
alter table public.sm_setlists
  add column event_date date,
  add column event_time time without time zone,
  add constraint sm_setlists_time_requires_date check (event_time is null or event_date is not null);
