-- Limit new uploads without excluding existing image scores.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/gif',
      'image/webp', 'image/bmp', 'image/avif', 'image/heic'
    ]
where id = 'sheet-music';

-- A row belonging to one user must not refer to another user's records or files.
drop policy "own pieces" on public.sm_pieces;
create policy "own pieces" on public.sm_pieces for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.sm_composers c where c.id = composer_id and c.user_id = auth.uid())
  );

drop policy "own practice log" on public.sm_practice_log;
create policy "own practice log" on public.sm_practice_log for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.sm_pieces p where p.id = piece_id and p.user_id = auth.uid())
  );

drop policy "own piece scores" on public.sm_piece_scores;
create policy "own piece scores" on public.sm_piece_scores for all
  using (
    user_id = auth.uid()
    and exists (select 1 from public.sm_pieces p where p.id = piece_id and p.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and split_part(pdf_path, '/', 1) = auth.uid()::text
    and exists (select 1 from public.sm_pieces p where p.id = piece_id and p.user_id = auth.uid())
  );

drop policy "own teaching materials" on public.sm_teaching_materials;
create policy "own teaching materials" on public.sm_teaching_materials for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and split_part(pdf_path, '/', 1) = auth.uid()::text);
