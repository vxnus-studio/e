-- Add manifest jsonb column to publisher_projects
alter table public.publisher_projects add column if not exists manifest jsonb;
