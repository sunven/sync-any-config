use keyring::{Entry, Error as KeyringError};

const KEYRING_SERVICE: &str = "com.sync-any-config.app";

fn secure_entry(key: &str) -> Result<Entry, String> {
    if key.trim().is_empty() {
        return Err("安全存储 key 不能为空".to_string());
    }
    Entry::new(KEYRING_SERVICE, key).map_err(|error| format!("打开安全存储失败: {:?}", error))
}

#[tauri::command]
pub fn secure_storage_get(key: String) -> Result<Option<String>, String> {
    let entry = secure_entry(&key)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("读取安全存储失败: {:?}", error)),
    }
}

#[tauri::command]
pub fn secure_storage_set(key: String, value: String) -> Result<(), String> {
    let entry = secure_entry(&key)?;
    entry
        .set_password(&value)
        .map_err(|error| format!("写入安全存储失败: {:?}", error))
}

#[tauri::command]
pub fn secure_storage_remove(key: String) -> Result<(), String> {
    let entry = secure_entry(&key)?;
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!("删除安全存储失败: {:?}", error)),
    }
}
