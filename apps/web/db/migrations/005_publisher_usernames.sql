-- One npm-like publisher namespace per Supabase account.
create table if not exists public.publisher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9-]{1,30}$'),
  created_at timestamptz not null default now()
);
alter table public.publisher_profiles enable row level security;
create policy "users can read their publisher profile" on public.publisher_profiles for select using (user_id = auth.uid());
create policy "users can create their publisher profile" on public.publisher_profiles for insert with check (user_id = auth.uid());

create or replace function public.handle_new_publisher_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.publisher_profiles (user_id, username)
  values (new.id, lower(new.raw_user_meta_data->>'username'));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_publisher_profile on auth.users;
create trigger on_auth_user_created_publisher_profile
  after insert on auth.users for each row execute procedure public.handle_new_publisher_profile();
