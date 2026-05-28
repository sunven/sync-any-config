begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_table('public', 'sync_devices', 'sync_devices table exists');
select has_table('public', 'sync_files', 'sync_files table exists');
select has_table('public', 'sync_file_revisions', 'sync_file_revisions table exists');
select has_table('public', 'sync_file_locations', 'sync_file_locations table exists');
select has_table('public', 'sync_conflicts', 'sync_conflicts table exists');
select has_function(
  'public',
  'create_file_revision_if_current',
  array['uuid', 'uuid', 'uuid', 'text', 'text', 'integer', 'text'],
  'revision CAS RPC exists'
);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'a@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'b@example.com');

insert into public.sync_devices (id, user_id, device_label, platform)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'A laptop', 'macos'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'B laptop', 'macos');

insert into public.sync_files (id, user_id, display_name, format, canonical_key, created_device_id)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'a.json', 'json', 'a:file', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'b.json', 'json', 'b:file', '10000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select results_eq(
  'select display_name from public.sync_files order by display_name',
  $$values ('a.json'::text)$$,
  'RLS only exposes current user files'
);

select lives_ok(
  $$insert into public.sync_files (user_id, display_name, format, canonical_key, created_device_id)
    values ('00000000-0000-0000-0000-000000000001', 'a2.json', 'json', 'a:file-2', '10000000-0000-0000-0000-000000000001')$$,
  'RLS allows inserting rows for current user'
);

select throws_ok(
  $$insert into public.sync_files (user_id, display_name, format, canonical_key, created_device_id)
    values ('00000000-0000-0000-0000-000000000002', 'b2.json', 'json', 'b:file-2', '10000000-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'RLS blocks inserting rows for another user'
);

select lives_ok(
  $$select public.create_file_revision_if_current(
    '20000000-0000-0000-0000-000000000001',
    null,
    '10000000-0000-0000-0000-000000000001',
    '{"theme":"dark"}',
    'hash-1',
    16,
    'Initial upload'
  )$$,
  'RPC creates first revision for current user when expected head is null'
);

select isnt(
  (select current_revision_id from public.sync_files where id = '20000000-0000-0000-0000-000000000001'),
  null,
  'RPC updates current_revision_id'
);

select throws_ok(
  format(
    $$select public.create_file_revision_if_current(
      '20000000-0000-0000-0000-000000000001',
      '%s',
      '10000000-0000-0000-0000-000000000001',
      '{"theme":"light"}',
      'hash-2',
      17,
      'Stale upload'
    )$$,
    '99999999-0000-0000-0000-000000000001'
  ),
  'P0001',
  'revision_conflict',
  'RPC rejects stale expected revision'
);

select throws_ok(
  $$select public.create_file_revision_if_current(
    '20000000-0000-0000-0000-000000000002',
    null,
    '10000000-0000-0000-0000-000000000001',
    '{"theme":"other"}',
    'hash-3',
    17,
    'Cross user upload'
  )$$,
  'P0001',
  'file_not_found',
  'RPC cannot write another user file'
);

update public.sync_files
set deleted_at = now()
where id = '20000000-0000-0000-0000-000000000001';

select throws_ok(
  $$select public.create_file_revision_if_current(
    '20000000-0000-0000-0000-000000000001',
    (select current_revision_id from public.sync_files where id = '20000000-0000-0000-0000-000000000001'),
    '10000000-0000-0000-0000-000000000001',
    '{"theme":"archived"}',
    'hash-4',
    20,
    'Archived upload'
  )$$,
  'P0001',
  'file_not_found',
  'RPC cannot write archived files'
);

select * from finish();

rollback;
