-- Supabase SQL Editorで全体を実行してください。新規プロジェクト向けです。
begin;

create table if not exists public.planner_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint planner_document_valid check (
    jsonb_typeof(document) = 'object'
    and document ?& array['schemaVersion', 'recipes', 'stores', 'week', 'shopping', 'history']
    and document->>'schemaVersion' = '1'
    and jsonb_typeof(document->'recipes') = 'array'
    and jsonb_typeof(document->'stores') = 'array'
    and jsonb_typeof(document->'week') = 'object'
    and jsonb_typeof(document->'shopping') = 'array'
    and jsonb_typeof(document->'history') = 'array'
    and octet_length(document::text) <= 20000000
  )
);

alter table public.planner_data enable row level security;
alter table public.planner_data force row level security;
revoke all on table public.planner_data from anon;
revoke all on table public.planner_data from authenticated;
grant select, insert, update on table public.planner_data to authenticated;

drop policy if exists planner_read_own on public.planner_data;
create policy planner_read_own on public.planner_data for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists planner_insert_own on public.planner_data;
create policy planner_insert_own on public.planner_data for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists planner_update_own on public.planner_data;
create policy planner_update_own on public.planner_data for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 1文書にレシピ・献立・買い物・履歴をまとめ、週切替を1トランザクションで保存。
-- revisionの一致を確認することで、別端末の更新を古い状態で上書きしない。
create or replace function public.save_planner(p_document jsonb, p_expected_revision integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_revision integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_document is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid document or revision' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.planner_data(user_id, document, revision)
      values(v_user, p_document, 1) on conflict(user_id) do nothing
      returning revision into v_revision;
  else
    update public.planner_data
      set document = p_document, revision = revision + 1, updated_at = now()
      where user_id = v_user and revision = p_expected_revision
      returning revision into v_revision;
  end if;
  if v_revision is null then
    raise exception 'Revision conflict' using errcode = '40001';
  end if;
  return v_revision;
end;
$$;
revoke all on function public.save_planner(jsonb, integer) from public, anon;
grant execute on function public.save_planner(jsonb, integer) to authenticated;
commit;
