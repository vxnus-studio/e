-- Registry metadata belongs in the Supabase Hub control plane.
create table if not exists public.registry_packs (
  package_id text not null,
  name text not null,
  publisher text not null,
  version text not null,
  schema_version text not null,
  description text,
  sources jsonb not null,
  capabilities jsonb not null,
  publisher_id uuid not null references auth.users(id) on delete restrict,
  distribution jsonb not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (package_id, version)
);
alter table public.registry_packs enable row level security;
create policy "anyone can read registry packs" on public.registry_packs for select using (true);
create policy "publishers can create registry packs" on public.registry_packs for insert with check (publisher_id = auth.uid());
create index if not exists registry_packs_publisher_idx on public.registry_packs(publisher_id);
