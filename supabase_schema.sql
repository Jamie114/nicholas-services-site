create extension if not exists pgcrypto;

create table if not exists public.broker_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  case_name text not null,
  app_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, case_name)
);

alter table public.broker_cases enable row level security;

drop policy if exists "broker_cases_select_own" on public.broker_cases;
create policy "broker_cases_select_own"
on public.broker_cases
for select to authenticated
using (auth.uid() = owner_id);

drop policy if exists "broker_cases_insert_own" on public.broker_cases;
create policy "broker_cases_insert_own"
on public.broker_cases
for insert to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "broker_cases_update_own" on public.broker_cases;
create policy "broker_cases_update_own"
on public.broker_cases
for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "broker_cases_delete_own" on public.broker_cases;
create policy "broker_cases_delete_own"
on public.broker_cases
for delete to authenticated
using (auth.uid() = owner_id);
