# Sync Any Config

Tauri desktop app for syncing arbitrary text config files across devices. It supports common formats such as JSON, YAML, TOML, INI, env files, and plain text.

File content is stored as plaintext in Supabase. Do not sync API keys, tokens, passwords, private keys, or other secrets.

## Current Behavior

- Google login via Supabase Auth.
- Users can add a local config file and upload its initial content.
- Users can add common AI-tool config presets such as Claude Desktop, Cursor, Codex, Claude Code, and MCP. Presets only suggest paths; the user still confirms the selected file.
- The same cloud file can map to a different local path on each device.
- Each device can pause or resume local file detection for its own path.
- Each device can unlink its own local path without deleting the local file or cloud file.
- Tauri watches linked local config files and refreshes state when they change, with a slow polling fallback.
- Each device can explicitly enable automatic upload for a linked local path. It uploads local changes only when the remote revision has not changed, and it never auto-downloads over local files.
- Restoring a cloud file to an existing local path asks for confirmation in Tauri, then writes with a backup.
- Recent revisions are visible per file, and restoring an older revision creates a new cloud revision.
- Cloud records can be renamed, archived, viewed in an archived list, and restored. Archiving removes the file from every device list but does not delete local files.
- Health check scans all current-device paths and reports missing files, read errors, local changes, remote changes, conflicts, paused files, and healthy files.
- Sync uses revision and hash checks before writing:
  - local unchanged, remote changed: download remote to local with a backup
  - local changed, remote unchanged: upload local as a new revision
  - both changed: stop and create a conflict
- Conflict UI supports:
  - use remote to overwrite local
  - keep local and upload it as the new remote revision
  - inspect local vs remote text and upload a manual merge

## Setup

Install dependencies:

```bash
pnpm install
```

Create `.env.local`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_AUTH_REDIRECT_URL=sync-any-config://auth/callback
```

Apply the database schema in Supabase:

```text
supabase/migrations/202605280001_init_sync_schema.sql
```

Supabase Auth redirect URLs should include:

```text
sync-any-config://auth/callback
http://localhost:1420/auth/callback
```

## Development

Web dev server:

```bash
pnpm dev
```

Tauri desktop dev:

```bash
pnpm tauri dev
```

On macOS, `tauri dev` may not register the custom `sync-any-config://` scheme. If the browser stops at a URL like:

```text
sync-any-config://auth/callback?code=...
```

copy the full URL from the browser address bar and paste it into the desktop app's callback input.

## Verification

```bash
pnpm lint
pnpm test
pnpm test:supabase
pnpm exec tsc --noEmit
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=dummy pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## Data Model

- `sync_devices`: one row per app install/device.
- `sync_files`: logical cloud files owned by a user.
- `sync_file_revisions`: plaintext revision history for each file.
- `sync_file_locations`: per-device local path and last-applied revision.
- `sync_conflicts`: local-vs-remote conflicts that need user action.

This is what allows computer A and computer B to sync the same logical config file even when the local filesystem paths are different.
