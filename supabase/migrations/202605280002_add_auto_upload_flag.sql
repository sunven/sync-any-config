alter table public.sync_file_locations
  add column if not exists auto_upload_enabled boolean not null default false;

notify pgrst, 'reload schema';
