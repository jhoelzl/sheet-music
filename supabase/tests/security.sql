begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(19);

insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'one@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'two@example.test');

insert into public.sm_composers (id, user_id, name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'One'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Two');
insert into public.sm_pieces (id, user_id, composer_id, title) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'One'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Two');
insert into public.sm_lessons (id, user_id, lesson_date, title) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '2026-01-01', 'One'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '2026-01-01', 'Two');
insert into public.sm_teaching_materials (id, user_id, title, pdf_path) values
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Two', '00000000-0000-0000-0000-000000000002/materials/two.pdf');
insert into public.sm_setlists (id, user_id, name) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'One'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Two');

select is((select file_size_limit from storage.buckets where id = 'sheet-music'), 52428800::bigint, 'bucket limits files to 50 MiB');
select ok((select not public and allowed_mime_types @> array['application/pdf', 'image/jpeg', 'image/png'] from storage.buckets where id = 'sheet-music'), 'bucket remains private and supports existing formats');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.sm_pieces), 1::bigint, 'cannot read another user’s pieces');
select lives_ok($$insert into public.sm_pieces (title, composer_id) values ('Own piece', '10000000-0000-0000-0000-000000000001')$$, 'can add a piece with an owned composer');
select throws_ok($$insert into public.sm_pieces (title, composer_id) values ('Foreign composer', '10000000-0000-0000-0000-000000000002')$$, '42501', null, 'cannot attach another user’s composer');
select throws_ok($$insert into public.sm_practice_log (piece_id) values ('20000000-0000-0000-0000-000000000002')$$, '42501', null, 'cannot log practice for another user’s piece');
select lives_ok($$insert into public.sm_piece_scores (piece_id, pdf_path, tags) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/score.pdf', array['piano'])$$, 'can attach an owned score');
select throws_ok($$insert into public.sm_piece_scores (piece_id, pdf_path, tags) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002/score.pdf', array['piano'])$$, '42501', null, 'cannot reference another user’s score file');
select throws_ok($$insert into public.sm_piece_scores (piece_id, pdf_path, tags) values ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001/score.pdf', array['piano'])$$, '42501', null, 'cannot attach a score to another user’s piece');
select lives_ok($$insert into public.sm_teaching_materials (title, pdf_path) values ('Own', '00000000-0000-0000-0000-000000000001/materials/one.pdf')$$, 'can add owned material');
select throws_ok($$insert into public.sm_teaching_materials (title, pdf_path) values ('Foreign', '00000000-0000-0000-0000-000000000002/materials/two.pdf')$$, '42501', null, 'cannot reference another user’s material file');
select lives_ok($$insert into public.sm_lesson_pieces (lesson_id, piece_id) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')$$, 'can link owned lesson and piece');
select throws_ok($$insert into public.sm_lesson_pieces (lesson_id, piece_id) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')$$, '42501', null, 'cannot link another user’s piece to a lesson');
select throws_ok($$insert into public.sm_lesson_pieces (lesson_id, piece_id) values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001')$$, '42501', null, 'cannot link a piece to another user’s lesson');
select throws_ok($$insert into public.sm_lesson_materials (lesson_id, material_id) values ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002')$$, '42501', null, 'cannot link another user’s material');
select lives_ok($$insert into public.sm_setlist_pieces (setlist_id, piece_id) values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')$$, 'can add owned piece to owned setlist');
select throws_ok($$insert into public.sm_setlist_pieces (setlist_id, piece_id) values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')$$, '42501', null, 'cannot add another user’s piece to a setlist');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('sheet-music', '00000000-0000-0000-0000-000000000001/one.pdf')$$, 'can store in own folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('sheet-music', '00000000-0000-0000-0000-000000000002/two.pdf')$$, '42501', null, 'cannot store in another user’s folder');

select * from finish();
rollback;
