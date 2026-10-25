create or replace function public.sm_piece_links_have_http_urls(link_data jsonb)
returns boolean
language sql
immutable
strict
parallel safe
as $$
  select case
    when jsonb_typeof(link_data) = 'array' then not exists (
      select 1
      from jsonb_array_elements(link_data) as entries(entry)
      where jsonb_typeof(entry) is distinct from 'object'
        or jsonb_typeof(entry->'url') is distinct from 'string'
        or (entry->>'url') !~* '^https?://'
    )
    else false
  end;
$$;

alter table public.sm_pieces
  drop constraint if exists sm_pieces_links_http_urls_check;

alter table public.sm_pieces
  add constraint sm_pieces_links_http_urls_check
  check (public.sm_piece_links_have_http_urls(links));
