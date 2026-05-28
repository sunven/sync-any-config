import { invoke, isTauri } from '@tauri-apps/api/core'
import { sha256Hex, utf8ByteSize } from '@/lib/sync-core/hashes'
import { MAX_SYNC_FILE_BYTES } from '@/lib/sync-core/types'

export interface LocalTextFile {
  path: string
  contents: string
  byteSize: number
  hash: string
}

export interface AtomicWriteResult {
  backup_path: string | null
}

export async function makeLocalTextFile(path: string, contents: string): Promise<LocalTextFile> {
  const byteSize = utf8ByteSize(contents)
  if (byteSize > MAX_SYNC_FILE_BYTES) {
    throw new Error(`文件超过 ${MAX_SYNC_FILE_BYTES} bytes，v1 暂不支持同步`)
  }
  return {
    path,
    contents,
    byteSize,
    hash: await sha256Hex(contents),
  }
}

export async function readLocalTextFile(path: string): Promise<LocalTextFile> {
  const contents = isTauri()
    ? await invoke<string>('read_text_file', { path })
    : localStorage.getItem(`mock-file:${path}`) ?? ''

  return makeLocalTextFile(path, contents)
}

export async function localPathExists(path: string): Promise<boolean> {
  if (!isTauri()) {
    return localStorage.getItem(`mock-file:${path}`) !== null
  }

  return invoke<boolean>('path_exists', { path })
}

export async function atomicWriteTextWithBackup(path: string, contents: string): Promise<AtomicWriteResult> {
  if (!isTauri()) {
    localStorage.setItem(`mock-file:${path}`, contents)
    return { backup_path: null }
  }

  return invoke<AtomicWriteResult>('atomic_write_text_with_backup', { path, contents })
}
