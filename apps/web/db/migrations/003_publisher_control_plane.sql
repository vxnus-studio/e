-- Supabase control plane for the Hub publisher workspace.
-- Apply this migration to Supabase, not the E-Teyvat Neon database.
create extension if not exists pgcrypto;

create table if not exists public.publisher_projects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  publisher text not null, name text not null, description text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (owner_id, publisher)
);
create table if not exists public.publisher_members (
  project_id uuid not null references public.publisher_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(), primary key (project_id, user_id)
);
create table if not exists public.publisher_sources (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.publisher_projects(id) on delete cascade,
  source_id text not null, title text not null, license text not null, uri text, created_at timestamptz not null default now(), unique (project_id, source_id)
);
create table if not exists public.publisher_revisions (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.publisher_projects(id) on delete cascade,
  revision_id text not null, manifest jsonb not null, checksum text, status text not null default 'draft' check (status in ('draft', 'valid', 'failed')),
  created_at timestamptz not null default now(), unique (project_id, revision_id)
);
create table if not exists public.publisher_releases (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.publisher_projects(id) on delete cascade,
  revision_id uuid not null references public.publisher_revisions(id) on delete restrict, package_id text not null, version text not null,
  status text not null default 'published' check (status in ('published', 'revoked')), created_at timestamptz not null default now(), unique (package_id, version)
);
create table if not exists public.publisher_distributions (
  id uuid primary key default gen_random_uuid(), release_id uuid not null references public.publisher_releases(id) on delete cascade,
  kind text not null check (kind in ('archive', 'provider')), url text not null, checksum text,
  status text not null default 'ready' check (status in ('pending', 'ready', 'failed', 'revoked')), created_at timestamptz not null default now()
);
create table if not exists public.publisher_audit_events (
  id bigint generated always as identity primary key, project_id uuid not null references public.publisher_projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null, action text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

alter table public.publisher_projects enable row level security;
alter table public.publisher_members enable row level security;
alter table public.publisher_sources enable row level security;
alter table public.publisher_revisions enable row level security;
alter table public.publisher_releases enable row level security;
alter table public.publisher_distributions enable row level security;
alter table public.publisher_audit_events enable row level security;
create policy "project owners and members can read projects" on public.publisher_projects for select using (owner_id = auth.uid() or exists (select 1 from public.publisher_members m where m.project_id = id and m.user_id = auth.uid()));
create policy "owners can create projects" on public.publisher_projects for insert with check (owner_id = auth.uid());
create policy "owners can update projects" on public.publisher_projects for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners can delete projects" on public.publisher_projects for delete using (owner_id = auth.uid());
create policy "members can read memberships" on public.publisher_members for select using (user_id = auth.uid() or exists (select 1 from public.publisher_projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "owners can manage memberships" on public.publisher_members for all using (exists (select 1 from public.publisher_projects p where p.id = project_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.publisher_projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "project members can read sources" on public.publisher_sources for select using (exists (select 1 from public.publisher_projects p left join public.publisher_members m on m.project_id = p.id where p.id = project_id and (p.owner_id = auth.uid() or m.user_id = auth.uid())));
create policy "project editors can manage sources" on public.publisher_sources for all using (exists (select 1 from public.publisher_projects p left join public.publisher_members m on m.project_id = p.id where p.id = project_id and (p.owner_id = auth.uid() or (m.user_id = auth.uid() and m.role = 'editor')))) with check (exists (select 1 from public.publisher_projects p left join public.publisher_members m on m.project_id = p.id where p.id = project_id and (p.owner_id = auth.uid() or (m.user_id = auth.uid() and m.role = 'editor'))));
create policy "project members can read revisions" on public.publisher_revisions for select using (exists (select 1 from public.publisher_projects p left join public.publisher_members m on m.project_id = p.id where p.id = project_id and (p.owner_id = auth.uid() or m.user_id = auth.uid())));
create policy "project editors can manage revisions" on public.publisher_revisions for all using (exists (select 1 from public.publisher_projects p left join public.publisher_members m on m.project_id = p.id where p.id = project_id and (p.owner_id = auth.uid() or (m.user_id = auth.uid() and m.role = 'editor')))) with check (exists (select 1 from public.publisher_projects p left join public.publisher_members m on m.project_id = p.id where p.id = project_id and (p.owner_id = auth.uid() or (m.user_id = auth.uid() and m.role = 'editor'))));
create policy "project members can read releases" on public.publisher_releases for select using (exists (select 1 from public.publisher_projects p left join public.publisher_members m on m.project_id = p.id where p.id = project_id and (p.owner_id = auth.uid() or m.user_id = auth.uid())));
create policy "project owners can manage releases" on public.publisher_releases for all using (exists (select 1 from public.publisher_projects p where p.id = project_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.publisher_projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "project members can read distributions" on public.publisher_distributions for select using (exists (select 1 from public.publisher_releases r join public.publisher_projects p on p.id = r.project_id left join public.publisher_members m on m.project_id = p.id where r.id = release_id and (p.owner_id = auth.uid() or m.user_id = auth.uid())));
create policy "project owners can manage distributions" on public.publisher_distributions for all using (exists (select 1 from public.publisher_releases r join public.publisher_projects p on p.id = r.project_id where r.id = release_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.publisher_releases r join public.publisher_projects p on p.id = r.project_id where r.id = release_id and p.owner_id = auth.uid()));
create policy "project members can read audit events" on public.publisher_audit_events for select using (exists (select 1 from public.publisher_projects p left join public.publisher_members m on m.project_id = p.id where p.id = project_id and (p.owner_id = auth.uid() or m.user_id = auth.uid())));
create policy "project owners can write audit events" on public.publisher_audit_events for insert with check (exists (select 1 from public.publisher_projects p where p.id = project_id and p.owner_id = auth.uid()));
create index if not exists publisher_projects_owner_idx on public.publisher_projects(owner_id);
create index if not exists publisher_releases_project_idx on public.publisher_releases(project_id);
create index if not exists publisher_audit_project_idx on public.publisher_audit_events(project_id, created_at desc);
