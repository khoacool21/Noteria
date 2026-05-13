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

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null default 'Inbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  user_name text,
  title text not null default 'Untitled Panel',
  folder text not null default 'Inbox',
  content text not null default '',
  sketch_paths jsonb not null default '[]'::jsonb,
  sketch_updated_at timestamptz,
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
alter table notes add column if not exists folder_id uuid references folders(id) on delete set null;
alter table notes add column if not exists user_name text;
alter table notes add column if not exists sketch_paths jsonb not null default '[]'::jsonb;
alter table notes add column if not exists sketch_updated_at timestamptz;
alter table pdfs add column if not exists note_id uuid references notes(id) on delete set null;
alter table pdfs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table images add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table summaries add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists notes_folder_id_idx on notes(folder_id);
create index if not exists folders_user_id_idx on folders(user_id);

insert into public.folders (user_id, name, created_at, updated_at)
select
  user_id,
  coalesce(nullif(trim(folder), ''), 'Inbox') as name,
  min(created_at),
  max(updated_at)
from public.notes
where user_id is not null
group by user_id, coalesce(nullif(trim(folder), ''), 'Inbox')
on conflict (user_id, name) do nothing;

update public.notes as note
set folder_id = folder.id
from public.folders as folder
where note.folder_id is null
  and note.user_id = folder.user_id
  and coalesce(nullif(trim(note.folder), ''), 'Inbox') = folder.name;

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
alter table folders enable row level security;
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

drop policy if exists "folders select own or admin" on folders;
drop policy if exists "folders insert own or admin" on folders;
drop policy if exists "folders update own or admin" on folders;
drop policy if exists "folders delete own or admin" on folders;

create policy "folders select own or admin"
on folders for select
using (user_id = auth.uid() or public.is_admin());

create policy "folders insert own or admin"
on folders for insert
with check (user_id = auth.uid() or public.is_admin());

create policy "folders update own or admin"
on folders for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "folders delete own or admin"
on folders for delete
using (user_id = auth.uid() or public.is_admin());

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
