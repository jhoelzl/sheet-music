do $$
begin
  if to_regclass('public.composers') is not null
     and to_regclass('public.sm_composers') is null then
    alter table public.composers rename to sm_composers;
  end if;

  if to_regclass('public.pieces') is not null
     and to_regclass('public.sm_pieces') is null then
    alter table public.pieces rename to sm_pieces;
  end if;
end
$$;
