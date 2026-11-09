-- Kjør i Supabase SQL Editor for PsyktFrisk-prosjektet.
-- Innholdet er ciphertext; dato og bruker-ID er metadata i klartekst.
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date),
  constraint ciphertext_version check (ciphertext like 'pf1.%'),
  constraint ciphertext_max_size check (octet_length(ciphertext) <= 262144)
);
alter table public.diary_entries enable row level security;
revoke all on public.diary_entries from anon;
grant select, insert, update, delete on public.diary_entries to authenticated;
drop policy if exists "diary_select_own" on public.diary_entries;
drop policy if exists "diary_insert_own" on public.diary_entries;
drop policy if exists "diary_update_own" on public.diary_entries;
drop policy if exists "diary_delete_own" on public.diary_entries;
create policy "diary_select_own" on public.diary_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "diary_insert_own" on public.diary_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "diary_update_own" on public.diary_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "diary_delete_own" on public.diary_entries for delete to authenticated using ((select auth.uid()) = user_id);
