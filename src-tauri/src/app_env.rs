use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppEnv {
    home: Option<String>,
    appdata: Option<String>,
    userprofile: Option<String>,
}

#[tauri::command]
pub fn get_app_env() -> AppEnv {
    AppEnv {
        home: std::env::var("HOME").ok(),
        appdata: std::env::var("APPDATA").ok(),
        userprofile: std::env::var("USERPROFILE").ok(),
    }
}
