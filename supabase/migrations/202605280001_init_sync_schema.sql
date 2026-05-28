create extension if not exists pgcrypto;

drop table if exists public.sync_conflicts;
drop table if exists public.sync_file_locations;
drop table if exists public.sync_file_revisions;
drop table if exists public.sync_files;
drop table if exists public.sync_devices;

create table public.sync_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint sync_devices_device_label_not_blank check (length(trim(device_label)) > 0),
  constraint sync_devices_platform_not_blank check (length(trim(platform)) > 0)
);

create table public.sync_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  format text,
  canonical_key text not null,
  current_revision_id uuid,
  created_device_id uuid not null references public.sync_devices(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paused boolean not null default false,
  deleted_at timestamptz,
  constraint sync_files_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint sync_files_canonical_key_not_blank check (length(trim(canonical_key)) > 0)
);

create table public.sync_file_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid not null references public.sync_files(id) on delete cascade,
  parent_revision_id uuid references public.sync_file_revisions(id),
  device_id uuid not null references public.sync_devices(id),
  content_text text not null,
  content_hash text not null,
  byte_size integer not null,
  created_at timestamptz not null default now(),
  message text,
  constraint sync_file_revisions_byte_size_limit check (byte_size >= 0 and byte_size <= 262144),
  constraint sync_file_revisions_hash_not_blank check (length(trim(content_hash)) > 0)
);

alter table public.sync_files
  add constraint sync_files_current_revision_fk
  foreign key (current_revision_id)
  references public.sync_file_revisions(id);

create table public.sync_file_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid not null references public.sync_files(id) on delete cascade,
  device_id uuid not null references public.sync_devices(id) on delete cascade,
  local_path text not null,
  last_applied_revision_id uuid references public.sync_file_revisions(id),
  local_hash text,
  watch_enabled boolean not null default true,
  auto_upload_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_file_locations_local_path_not_blank check (length(trim(local_path)) > 0),
  constraint sync_file_locations_unique_file_device unique (file_id, device_id)
);

create table public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid not null references public.sync_files(id) on delete cascade,
  device_id uuid not null references public.sync_devices(id),
  base_revision_id uuid references public.sync_file_revisions(id),
  remote_revision_id uuid not null references public.sync_file_revisions(id),
  local_content_text text not null,
  local_content_hash text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint sync_conflicts_status_check check (
    status in ('open', 'resolved_keep_local', 'resolved_use_remote', 'resolved_manual_merge')
  ),
  constraint sync_conflicts_local_hash_not_blank check (length(trim(local_content_hash)) > 0)
);

create unique index sync_files_unique_live_canonical_key
on public.sync_files (user_id, canonical_key)
where deleted_at is null;

create index sync_file_revisions_file_created_idx
on public.sync_file_revisions (file_id, created_at desc);

create index sync_conflicts_open_file_idx
on public.sync_conflicts (file_id, status)
where status = 'open';

alter table public.sync_devices enable row level security;
alter table public.sync_files enable row level security;
alter table public.sync_file_revisions enable row level security;
alter table public.sync_file_locations enable row level security;
alter table public.sync_conflicts enable row level security;

create policy "users can manage own devices"
on public.sync_devices
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "users can manage own files"
on public.sync_files
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "users can manage own revisions"
on public.sync_file_revisions
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "users can manage own locations"
on public.sync_file_locations
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "users can manage own conflicts"
on public.sync_conflicts
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create or replace function public.create_file_revision_if_current(
  p_file_id uuid,
  p_expected_current_revision_id uuid,
  p_device_id uuid,
  p_content_text text,
  p_content_hash text,
  p_byte_size integer,
  p_message text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision_id uuid;
  v_revision_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_byte_size < 0 or p_byte_size > 262144 then
    raise exception 'file_too_large';
  end if;

  perform 1
  from public.sync_devices
  where id = p_device_id
    and user_id = v_user_id;

  if not found then
    raise exception 'device_not_found';
  end if;

  select current_revision_id
  into v_current_revision_id
  from public.sync_files
  where id = p_file_id
    and user_id = v_user_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'file_not_found';
  end if;

  if v_current_revision_id is distinct from p_expected_current_revision_id then
    raise exception 'revision_conflict';
  end if;

  insert into public.sync_file_revisions (
    user_id,
    file_id,
    parent_revision_id,
    device_id,
    content_text,
    content_hash,
    byte_size,
    message
  )
  values (
    v_user_id,
    p_file_id,
    p_expected_current_revision_id,
    p_device_id,
    p_content_text,
    p_content_hash,
    p_byte_size,
    p_message
  )
  returning id into v_revision_id;

  update public.sync_files
  set current_revision_id = v_revision_id,
      updated_at = now()
  where id = p_file_id
    and user_id = v_user_id;

  return v_revision_id;
end;
$$;

notify pgrst, 'reload schema';
