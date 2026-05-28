import type { RemoteHeadResult } from '@/lib/sync-core/types'
import { supabase } from '@/auth/supabase-client'

export interface SyncDeviceInput {
  id: string
  deviceLabel: string
  platform: string
}

export interface CreateTrackedFileInput {
  displayName: string
  format: string | null
  canonicalKey: string
  createdDeviceId: string
}

export interface CreateRevisionInput {
  fileId: string
  expectedCurrentRevisionId: string | null
  deviceId: string
  contentText: string
  contentHash: string
  byteSize: number
  message?: string
}

export interface RemoteFileListItem {
  id: string
  displayName: string
  format: string | null
  canonicalKey: string
  currentRevisionId: string | null
  updatedAt: string
  paused: boolean
  localPath: string | null
  lastAppliedRevisionId: string | null
  localHash: string | null
  watchEnabled: boolean
  autoUploadEnabled: boolean
  latestRevision: {
    id: string
    contentHash: string
    byteSize: number
    createdAt: string
  } | null
  openConflictCount: number
}

export interface ArchivedFileListItem {
  id: string
  displayName: string
  format: string | null
  canonicalKey: string
  currentRevisionId: string | null
  updatedAt: string
  deletedAt: string
}

export interface RevisionSnapshot {
  id: string
  fileId: string
  parentRevisionId: string | null
  deviceId: string
  contentText: string
  contentHash: string
  byteSize: number
  createdAt: string
  message: string | null
}

export interface RevisionListItem {
  id: string
  parentRevisionId: string | null
  deviceId: string
  contentHash: string
  byteSize: number
  createdAt: string
  message: string | null
}

export interface UpsertFileLocationInput {
  fileId: string
  deviceId: string
  localPath: string
  lastAppliedRevisionId: string | null
  localHash: string | null
  watchEnabled?: boolean
  autoUploadEnabled?: boolean
}

export interface UpdateFileLocationInput {
  fileId: string
  deviceId: string
  lastAppliedRevisionId: string | null
  localHash: string | null
}

export interface SetFileLocationWatchInput {
  fileId: string
  deviceId: string
  watchEnabled: boolean
}

export interface SetFileLocationAutoUploadInput {
  fileId: string
  deviceId: string
  autoUploadEnabled: boolean
}

export interface RenameTrackedFileInput {
  fileId: string
  displayName: string
}

export interface CreateConflictInput {
  fileId: string
  deviceId: string
  baseRevisionId: string | null
  remoteRevisionId: string
  localContentText: string
  localContentHash: string
}

export interface ConflictSnapshot {
  id: string
  fileId: string
  deviceId: string
  baseRevisionId: string | null
  remoteRevisionId: string
  localContentText: string
  localContentHash: string
  status: string
  createdAt: string
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('缺少 Supabase 配置')
  }
  return supabase
}

export async function upsertDevice(input: SyncDeviceInput) {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) {
    throw userError
  }
  if (!userData.user) {
    throw new Error('请先登录 Google 账号')
  }

  const { data, error } = await client
    .from('sync_devices')
    .upsert({
      id: input.id,
      user_id: userData.user.id,
      device_label: input.deviceLabel,
      platform: input.platform,
      last_seen_at: new Date().toISOString(),
    })
    .select('id,user_id,device_label,platform,last_seen_at')
    .single()

  if (error) {
    throw error
  }
  return data
}

export async function listTrackedFiles(deviceId: string): Promise<RemoteFileListItem[]> {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) {
    throw userError
  }
  if (!userData.user) {
    throw new Error('请先登录 Google 账号')
  }

  const { data: files, error: filesError } = await client
    .from('sync_files')
    .select('id,display_name,format,canonical_key,current_revision_id,updated_at,paused')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (filesError) {
    throw filesError
  }

  const fileIds = (files ?? []).map(file => file.id)
  if (fileIds.length === 0) {
    return []
  }

  const currentRevisionIds = (files ?? []).map(file => file.current_revision_id).filter(Boolean) as string[]
  const revisionsQuery = currentRevisionIds.length > 0
    ? client
        .from('sync_file_revisions')
        .select('id,file_id,content_hash,byte_size,created_at')
        .in('id', currentRevisionIds)
    : Promise.resolve({ data: [], error: null })

  const [{ data: revisions, error: revisionsError }, { data: locations, error: locationsError }, { data: conflicts, error: conflictsError }] = await Promise.all([
    revisionsQuery,
    client
      .from('sync_file_locations')
      .select('file_id,local_path,last_applied_revision_id,local_hash,watch_enabled,auto_upload_enabled')
      .eq('device_id', deviceId)
      .in('file_id', fileIds),
    client
      .from('sync_conflicts')
      .select('file_id')
      .eq('device_id', deviceId)
      .eq('status', 'open')
      .in('file_id', fileIds),
  ])

  if (revisionsError) {
    throw revisionsError
  }
  if (locationsError) {
    throw locationsError
  }
  if (conflictsError) {
    throw conflictsError
  }

  const revisionsById = new Map((revisions ?? []).map(revision => [revision.id, revision]))
  const locationsByFileId = new Map((locations ?? []).map(location => [location.file_id, location]))
  const conflictCountsByFileId = new Map<string, number>()
  for (const conflict of conflicts ?? []) {
    conflictCountsByFileId.set(conflict.file_id, (conflictCountsByFileId.get(conflict.file_id) ?? 0) + 1)
  }

  return (files ?? []).map((file) => {
    const location = locationsByFileId.get(file.id)
    const latestRevision = file.current_revision_id ? revisionsById.get(file.current_revision_id) : null

    return {
      id: file.id,
      displayName: file.display_name,
      format: file.format,
      canonicalKey: file.canonical_key,
      currentRevisionId: file.current_revision_id,
      updatedAt: file.updated_at,
      paused: file.paused,
      localPath: location?.local_path ?? null,
      lastAppliedRevisionId: location?.last_applied_revision_id ?? null,
      localHash: location?.local_hash ?? null,
      watchEnabled: location?.watch_enabled ?? true,
      autoUploadEnabled: location?.auto_upload_enabled ?? false,
      latestRevision: latestRevision
        ? {
            id: latestRevision.id,
            contentHash: latestRevision.content_hash,
            byteSize: latestRevision.byte_size,
            createdAt: latestRevision.created_at,
          }
        : null,
      openConflictCount: conflictCountsByFileId.get(file.id) ?? 0,
    }
  })
}

export async function listArchivedTrackedFiles(): Promise<ArchivedFileListItem[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_files')
    .select('id,display_name,format,canonical_key,current_revision_id,updated_at,deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map(file => ({
    id: file.id,
    displayName: file.display_name,
    format: file.format,
    canonicalKey: file.canonical_key,
    currentRevisionId: file.current_revision_id,
    updatedAt: file.updated_at,
    deletedAt: file.deleted_at,
  }))
}

export async function findTrackedFileByCanonicalKey(deviceId: string, canonicalKey: string): Promise<RemoteFileListItem | null> {
  const files = await listTrackedFiles(deviceId)
  return files.find(file => file.canonicalKey === canonicalKey) ?? null
}

export async function fetchRemoteHeads(): Promise<RemoteHeadResult[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_files')
    .select('id,current_revision_id')
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return (data ?? []).map(row => ({
    fileId: row.id,
    readOk: true,
    currentRevisionId: row.current_revision_id,
  }))
}

export async function fetchRemoteHead(fileId: string): Promise<RemoteHeadResult> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_files')
    .select('id,current_revision_id')
    .eq('id', fileId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    return { fileId, readOk: false, reason: error.message }
  }
  if (!data) {
    return { fileId, readOk: false, reason: 'file_not_found' }
  }

  return {
    fileId: data.id,
    readOk: true,
    currentRevisionId: data.current_revision_id,
  }
}

export async function createTrackedFile(input: CreateTrackedFileInput) {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) {
    throw userError
  }
  if (!userData.user) {
    throw new Error('请先登录 Google 账号')
  }

  const { data, error } = await client
    .from('sync_files')
    .insert({
      user_id: userData.user.id,
      display_name: input.displayName,
      format: input.format,
      canonical_key: input.canonicalKey,
      created_device_id: input.createdDeviceId,
    })
    .select('id,user_id,display_name,format,canonical_key,current_revision_id')
    .single()

  if (error) {
    throw error
  }
  return data
}

export async function renameTrackedFile(input: RenameTrackedFileInput) {
  const client = requireSupabase()
  const trimmedName = input.displayName.trim()
  if (!trimmedName) {
    throw new Error('文件名不能为空')
  }

  const { data, error } = await client
    .from('sync_files')
    .update({
      display_name: trimmedName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.fileId)
    .is('deleted_at', null)
    .select('id,display_name,updated_at')
    .single()

  if (error) {
    throw error
  }
  return data
}

export async function archiveTrackedFile(fileId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_files')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId)
    .is('deleted_at', null)
    .select('id,deleted_at')
    .single()

  if (error) {
    throw error
  }
  return data
}

export async function restoreArchivedTrackedFile(fileId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_files')
    .update({
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId)
    .not('deleted_at', 'is', null)
    .select('id,deleted_at,updated_at')
    .single()

  if (error) {
    throw error
  }
  return data
}

export async function fetchRevision(revisionId: string): Promise<RevisionSnapshot> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_file_revisions')
    .select('id,file_id,parent_revision_id,device_id,content_text,content_hash,byte_size,created_at,message')
    .eq('id', revisionId)
    .single()

  if (error) {
    throw error
  }

  return {
    id: data.id,
    fileId: data.file_id,
    parentRevisionId: data.parent_revision_id,
    deviceId: data.device_id,
    contentText: data.content_text,
    contentHash: data.content_hash,
    byteSize: data.byte_size,
    createdAt: data.created_at,
    message: data.message,
  }
}

export async function listFileRevisions(fileId: string, limit = 12): Promise<RevisionListItem[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_file_revisions')
    .select('id,parent_revision_id,device_id,content_hash,byte_size,created_at,message')
    .eq('file_id', fileId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []).map(revision => ({
    id: revision.id,
    parentRevisionId: revision.parent_revision_id,
    deviceId: revision.device_id,
    contentHash: revision.content_hash,
    byteSize: revision.byte_size,
    createdAt: revision.created_at,
    message: revision.message,
  }))
}

export async function createRevisionIfCurrent(input: CreateRevisionInput) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_file_revision_if_current', {
    p_file_id: input.fileId,
    p_expected_current_revision_id: input.expectedCurrentRevisionId,
    p_device_id: input.deviceId,
    p_content_text: input.contentText,
    p_content_hash: input.contentHash,
    p_byte_size: input.byteSize,
    p_message: input.message ?? null,
  })

  if (error) {
    throw error
  }
  return data as string
}

export async function upsertFileLocation(input: UpsertFileLocationInput) {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) {
    throw userError
  }
  if (!userData.user) {
    throw new Error('请先登录 Google 账号')
  }

  const { data, error } = await client
    .from('sync_file_locations')
    .upsert({
      user_id: userData.user.id,
      file_id: input.fileId,
      device_id: input.deviceId,
      local_path: input.localPath,
      last_applied_revision_id: input.lastAppliedRevisionId,
      local_hash: input.localHash,
      watch_enabled: input.watchEnabled ?? true,
      auto_upload_enabled: input.autoUploadEnabled ?? false,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'file_id,device_id',
    })
    .select('id,file_id,device_id,local_path,last_applied_revision_id,local_hash,watch_enabled,auto_upload_enabled,updated_at')
    .single()

  if (error) {
    throw error
  }
  return data
}

export async function updateFileLocationAfterApply(input: UpdateFileLocationInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_file_locations')
    .update({
      last_applied_revision_id: input.lastAppliedRevisionId,
      local_hash: input.localHash,
      updated_at: new Date().toISOString(),
    })
    .eq('file_id', input.fileId)
    .eq('device_id', input.deviceId)
    .select('id,file_id,device_id,local_path,last_applied_revision_id,local_hash,watch_enabled,auto_upload_enabled,updated_at')
    .single()

  if (error) {
    throw error
  }
  return data
}

export async function setFileLocationWatchEnabled(input: SetFileLocationWatchInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_file_locations')
    .update({
      watch_enabled: input.watchEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('file_id', input.fileId)
    .eq('device_id', input.deviceId)
    .select('id,file_id,device_id,local_path,last_applied_revision_id,local_hash,watch_enabled,auto_upload_enabled,updated_at')
    .single()

  if (error) {
    throw error
  }
  return data
}

export async function setFileLocationAutoUploadEnabled(input: SetFileLocationAutoUploadInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_file_locations')
    .update({
      auto_upload_enabled: input.autoUploadEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('file_id', input.fileId)
    .eq('device_id', input.deviceId)
    .select('id,file_id,device_id,local_path,last_applied_revision_id,local_hash,watch_enabled,auto_upload_enabled,updated_at')
    .single()

  if (error) {
    throw error
  }
  return data
}

export async function unlinkFileLocation(fileId: string, deviceId: string) {
  const client = requireSupabase()
  const { error } = await client
    .from('sync_file_locations')
    .delete()
    .eq('file_id', fileId)
    .eq('device_id', deviceId)

  if (error) {
    throw error
  }
}

export async function createConflict(input: CreateConflictInput) {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) {
    throw userError
  }
  if (!userData.user) {
    throw new Error('请先登录 Google 账号')
  }

  const { data, error } = await client
    .from('sync_conflicts')
    .insert({
      user_id: userData.user.id,
      file_id: input.fileId,
      device_id: input.deviceId,
      base_revision_id: input.baseRevisionId,
      remote_revision_id: input.remoteRevisionId,
      local_content_text: input.localContentText,
      local_content_hash: input.localContentHash,
    })
    .select('id,file_id,device_id,base_revision_id,remote_revision_id,status,created_at')
    .single()

  if (error) {
    throw error
  }
  return data
}

export async function fetchOpenConflict(fileId: string, deviceId: string): Promise<ConflictSnapshot | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_conflicts')
    .select('id,file_id,device_id,base_revision_id,remote_revision_id,local_content_text,local_content_hash,status,created_at')
    .eq('file_id', fileId)
    .eq('device_id', deviceId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }
  if (!data) {
    return null
  }

  return {
    id: data.id,
    fileId: data.file_id,
    deviceId: data.device_id,
    baseRevisionId: data.base_revision_id,
    remoteRevisionId: data.remote_revision_id,
    localContentText: data.local_content_text,
    localContentHash: data.local_content_hash,
    status: data.status,
    createdAt: data.created_at,
  }
}

export async function resolveConflict(conflictId: string, status: 'resolved_keep_local' | 'resolved_use_remote' | 'resolved_manual_merge') {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sync_conflicts')
    .update({
      status,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', conflictId)
    .eq('status', 'open')
    .select('id,status,resolved_at')
    .single()

  if (error) {
    throw error
  }
  return data
}
