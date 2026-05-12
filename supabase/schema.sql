create extension if not exists "pgcrypto";

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  age integer,
  gender text,
  country text,
  phone text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Admin',
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  title text not null default 'Untitled Panel',
  folder text not null default 'Inbox',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists pdfs (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists summaries (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes(id) on delete cascade,
  pdf_id uuid references pdfs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table notes add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table notes add column if not exists user_name text;
alter table pdfs add column if not exists note_id uuid references notes(id) on delete set null;
alter table pdfs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table images add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table summaries add column if not exists user_id uuid references auth.users(id) on delete cascade;

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_profiles where id = check_user_id)
    or exists (select 1 from public.user_profiles where id = check_user_id and role = 'admin');
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.admin_profiles where id = new.id) then
    insert into public.user_profiles (id, name, email, phone, gender, country, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      new.email,
      new.raw_user_meta_data->>'phone',
      new.raw_user_meta_data->>'gender',
      new.raw_user_meta_data->>'country',
      'user'
    )
    on conflict (id) do update set
      name = excluded.name,
      email = excluded.email,
      phone = excluded.phone,
      gender = excluded.gender,
      country = excluded.country,
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table user_profiles enable row level security;
alter table admin_profiles enable row level security;
alter table notes enable row level security;
alter table images enable row level security;
alter table pdfs enable row level security;
alter table summaries enable row level security;

drop policy if exists "users read own profile admins read all" on user_profiles;
drop policy if exists "users update own profile admins update all" on user_profiles;
drop policy if exists "admins update user profiles" on user_profiles;
drop policy if exists "admins read admin profiles" on admin_profiles;

create policy "users read own profile admins read all"
on user_profiles for select
using (id = auth.uid() or public.is_admin());

create policy "admins update user profiles"
on user_profiles for update
using (public.is_admin())
with check (public.is_admin());

create policy "admins read admin profiles"
on admin_profiles for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "notes select own or admin" on notes;
drop policy if exists "notes insert own" on notes;
drop policy if exists "notes update own or admin" on notes;
drop policy if exists "notes delete own or admin" on notes;
drop policy if exists "public read notes" on notes;
drop policy if exists "public insert notes" on notes;
drop policy if exists "public update notes" on notes;

create policy "notes select own or admin"
on notes for select
using (user_id = auth.uid() or public.is_admin());

create policy "notes insert own"
on notes for insert
with check (user_id = auth.uid());

create policy "notes update own or admin"
on notes for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "notes delete own or admin"
on notes for delete
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "images select own or admin" on images;
drop policy if exists "images insert own" on images;
drop policy if exists "public read images" on images;
drop policy if exists "public insert images" on images;
create policy "images select own or admin"
on images for select
using (user_id = auth.uid() or public.is_admin());
create policy "images insert own"
on images for insert
with check (user_id = auth.uid());

drop policy if exists "pdfs select own or admin" on pdfs;
drop policy if exists "pdfs insert own" on pdfs;
drop policy if exists "public read pdfs" on pdfs;
drop policy if exists "public insert pdfs" on pdfs;
create policy "pdfs select own or admin"
on pdfs for select
using (user_id = auth.uid() or public.is_admin());
create policy "pdfs insert own"
on pdfs for insert
with check (user_id = auth.uid());

drop policy if exists "summaries select own or admin" on summaries;
drop policy if exists "summaries insert own" on summaries;
drop policy if exists "public read summaries" on summaries;
drop policy if exists "public insert summaries" on summaries;
create policy "summaries select own or admin"
on summaries for select
using (user_id = auth.uid() or public.is_admin());
create policy "summaries insert own"
on summaries for insert
with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('images', 'images', true), ('pdfs', 'pdfs', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "authenticated read images" on storage.objects;
drop policy if exists "authenticated insert images" on storage.objects;
drop policy if exists "authenticated read pdfs" on storage.objects;
drop policy if exists "authenticated insert pdfs" on storage.objects;
drop policy if exists "public read images" on storage.objects;
drop policy if exists "public insert images" on storage.objects;
drop policy if exists "public read pdfs" on storage.objects;
drop policy if exists "public insert pdfs" on storage.objects;

create policy "authenticated read images"
on storage.objects for select
using (bucket_id = 'images' and auth.role() = 'authenticated');

create policy "authenticated insert images"
on storage.objects for insert
with check (bucket_id = 'images' and auth.role() = 'authenticated');

create policy "authenticated read pdfs"
on storage.objects for select
using (bucket_id = 'pdfs' and auth.role() = 'authenticated');

create policy "authenticated insert pdfs"
on storage.objects for insert
with check (bucket_id = 'pdfs' and auth.role() = 'authenticated');

-- Manual admin setup after creating an admin in Supabase Auth:
-- insert into public.admin_profiles (id, name)
-- values ('AUTH_USER_UUID_HERE', 'Admin')
-- on conflict (id) do update set name = 'Admin';
