use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AtomicWriteResult {
    backup_path: Option<String>,
}

fn backup_path_for(path: &Path) -> Result<PathBuf, String> {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "文件路径无效".to_string())?;
    let backup_name = format!("{file_name}.sync-any-config.bak");
    Ok(path.with_file_name(backup_name))
}

pub fn atomic_write_text_with_backup_impl(path: &Path, contents: &str) -> Result<AtomicWriteResult, String> {
    let parent = path.parent().ok_or_else(|| "文件必须有父目录".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("创建父目录失败: {error}"))?;

    let backup_path = if path.exists() {
        let backup_path = backup_path_for(path)?;
        fs::copy(path, &backup_path).map_err(|error| format!("创建备份失败: {error}"))?;
        Some(backup_path)
    }
    else {
        None
    };

    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|error| format!("创建临时文件失败: {error}"))?;
    temp.write_all(contents.as_bytes())
        .map_err(|error| format!("写入临时文件失败: {error}"))?;
    temp.flush().map_err(|error| format!("刷新临时文件失败: {error}"))?;
    temp.as_file()
        .sync_all()
        .map_err(|error| format!("同步临时文件失败: {error}"))?;
    temp.persist(path)
        .map_err(|error| format!("替换文件失败: {}", error.error))?;

    Ok(AtomicWriteResult {
        backup_path: backup_path.map(|path| path.to_string_lossy().to_string()),
    })
}

pub fn read_text_file_impl(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|error| format!("读取文件信息失败: {error}"))?;
    if !metadata.is_file() {
        return Err("请选择普通文本文件".to_string());
    }
    if metadata.len() > 262_144 {
        return Err("文件超过 262144 bytes，v1 暂不支持同步".to_string());
    }

    fs::read_to_string(path).map_err(|error| format!("读取文本文件失败: {error}"))
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn atomic_write_text_with_backup(path: String, contents: String) -> Result<AtomicWriteResult, String> {
    atomic_write_text_with_backup_impl(Path::new(&path), &contents)
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    read_text_file_impl(Path::new(&path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_new_file_without_backup() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");

        let result = atomic_write_text_with_backup_impl(&path, "{\"ok\":true}").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "{\"ok\":true}");
        assert!(result.backup_path.is_none());
    }

    #[test]
    fn replaces_existing_file_and_creates_backup() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        fs::write(&path, "old").unwrap();

        let result = atomic_write_text_with_backup_impl(&path, "new").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        let backup_path = result.backup_path.unwrap();
        assert_eq!(fs::read_to_string(backup_path).unwrap(), "old");
    }

    #[test]
    fn reads_text_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        fs::write(&path, "theme = \"dark\"").unwrap();

        let result = read_text_file_impl(&path).unwrap();

        assert_eq!(result, "theme = \"dark\"");
    }

    #[test]
    fn rejects_large_text_file_reads() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("large.json");
        fs::write(&path, "a".repeat(262_145)).unwrap();

        let error = read_text_file_impl(&path).unwrap_err();

        assert!(error.contains("超过 262144 bytes"));
    }

    #[test]
    fn checks_path_existence() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");

        assert!(!path_exists(path.to_string_lossy().to_string()));
        fs::write(&path, "{}").unwrap();
        assert!(path_exists(path.to_string_lossy().to_string()));
    }
}
