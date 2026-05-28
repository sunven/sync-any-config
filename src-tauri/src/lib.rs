mod app_env;
mod atomic_file;
mod file_watcher;
mod secure_storage;

pub fn run() {
    tauri::Builder::default()
        .manage(file_watcher::FileWatcherState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            secure_storage::secure_storage_get,
            secure_storage::secure_storage_set,
            secure_storage::secure_storage_remove,
            atomic_file::atomic_write_text_with_backup,
            atomic_file::path_exists,
            atomic_file::read_text_file,
            app_env::get_app_env,
            file_watcher::watch_config_files,
            file_watcher::clear_config_file_watchers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
