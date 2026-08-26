alter table public.registry_packs add column if not exists api_contract jsonb;
alter table public.publisher_releases add column if not exists api_contract jsonb;
