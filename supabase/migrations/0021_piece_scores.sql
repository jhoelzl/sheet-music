-- Scores: a piece can hold several PDFs, each with its own musical key and instrument.
create table public.sm_piece_scores (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.sm_pieces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pdf_path text not null,
  pdf_pages integer check (pdf_pages > 0),
  musical_key text,
  instrument text not null check (instrument in ('piano', 'guitar')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index sm_piece_scores_piece_id_idx on public.sm_piece_scores (piece_id);

alter table public.sm_piece_scores enable row level security;
create policy "own piece scores" on public.sm_piece_scores for all
  using (
    user_id = auth.uid()
    and exists (select 1 from public.sm_pieces p where p.id = piece_id and p.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.sm_pieces p where p.id = piece_id and p.user_id = auth.uid())
  );

-- Move each existing single PDF into a score row. The instrument comes from the
-- piece's instrument list when it is unambiguously guitar, otherwise piano.
insert into public.sm_piece_scores (piece_id, user_id, pdf_path, pdf_pages, musical_key, instrument, position)
select
  id,
  user_id,
  pdf_path,
  pdf_pages,
  musical_key,
  case when 'guitar' = any (instruments) and not ('piano' = any (instruments)) then 'guitar' else 'piano' end,
  0
from public.sm_pieces
where pdf_path is not null;

-- Key, instrument and PDF now live on each score, so the piece no longer stores them.
alter table public.sm_pieces
  drop column pdf_path,
  drop column pdf_pages,
  drop column musical_key,
  drop column instruments;
