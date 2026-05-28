use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct FileWatcherState {
    inner: Mutex<WatcherStore>,
}

#[derive(Default)]
struct WatcherStore {
    watched_paths: HashSet<PathBuf>,
    last_emitted_at: HashMap<PathBuf, Instant>,
    watchers: Vec<RecommendedWatcher>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ConfigFileChangedPayload {
    path: String,
}

#[tauri::command]
pub fn watch_config_files(
    app: AppHandle,
    state: State<'_, FileWatcherState>,
    paths: Vec<String>,
) -> Result<(), String> {
    let normalized_paths = normalize_paths(paths);
    let directories = directories_for_paths(&normalized_paths);

    let mut next_watchers = Vec::new();
    for directory in directories {
        let app_handle = app.clone();
        let mut watcher = RecommendedWatcher::new(
            move |result| {
                if let Ok(event) = result {
                    emit_matching_file_events(&app_handle, event);
                }
            },
            Config::default(),
        )
        .map_err(|error| error.to_string())?;

        watcher
            .watch(&directory, RecursiveMode::NonRecursive)
            .map_err(|error| format!("watch {} failed: {error}", directory.display()))?;
        next_watchers.push(watcher);
    }

    let mut store = state
        .inner
        .lock()
        .map_err(|_| "file watcher state lock failed".to_string())?;
    store.watched_paths = normalized_paths;
    let watched_paths = store.watched_paths.clone();
    store.last_emitted_at.retain(|path, _| watched_paths.contains(path));
    store.watchers = next_watchers;

    Ok(())
}

#[tauri::command]
pub fn clear_config_file_watchers(state: State<'_, FileWatcherState>) -> Result<(), String> {
    let mut store = state
        .inner
        .lock()
        .map_err(|_| "file watcher state lock failed".to_string())?;
    store.watched_paths.clear();
    store.last_emitted_at.clear();
    store.watchers.clear();
    Ok(())
}

fn normalize_paths(paths: Vec<String>) -> HashSet<PathBuf> {
    paths
        .into_iter()
        .filter_map(|path| {
            let trimmed = path.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(PathBuf::from(trimmed))
            }
        })
        .collect()
}

fn directories_for_paths(paths: &HashSet<PathBuf>) -> HashSet<PathBuf> {
    paths
        .iter()
        .filter_map(|path| path.parent().map(Path::to_path_buf))
        .collect()
}

fn emit_matching_file_events(app: &AppHandle, event: Event) {
    let Some(state) = app.try_state::<FileWatcherState>() else {
        return;
    };

    for path in event.paths {
        let Ok(mut store) = state.inner.lock() else {
            return;
        };

        let Some(watched_path) = matching_watched_path(&store.watched_paths, &path) else {
            continue;
        };

        if !should_emit(&mut store.last_emitted_at, &watched_path) {
            continue;
        }

        drop(store);
        let _ = app.emit(
            "config-file-changed",
            ConfigFileChangedPayload {
                path: watched_path.to_string_lossy().into_owned(),
            },
        );
    }
}

fn matching_watched_path(watched_paths: &HashSet<PathBuf>, event_path: &Path) -> Option<PathBuf> {
    watched_paths
        .iter()
        .find(|watched_path| event_path == watched_path.as_path())
        .cloned()
}

fn should_emit(last_emitted_at: &mut HashMap<PathBuf, Instant>, path: &Path) -> bool {
    let now = Instant::now();
    if let Some(last_emit) = last_emitted_at.get(path) {
        if now.duration_since(*last_emit) < Duration::from_millis(500) {
            return false;
        }
    }

    last_emitted_at.insert(path.to_path_buf(), now);
    true
}

#[cfg(test)]
mod tests {
    use super::{directories_for_paths, matching_watched_path, normalize_paths, should_emit};
    use std::{collections::HashMap, path::PathBuf};

    #[test]
    fn normalizes_non_empty_paths() {
        let paths = normalize_paths(vec![
            " /tmp/config.json ".to_string(),
            "".to_string(),
            "   ".to_string(),
        ]);

        assert_eq!(paths.len(), 1);
        assert!(paths.contains(&PathBuf::from("/tmp/config.json")));
    }

    #[test]
    fn watches_parent_directories_once() {
        let paths = normalize_paths(vec![
            "/tmp/a/config.json".to_string(),
            "/tmp/a/settings.toml".to_string(),
            "/tmp/b/config.yml".to_string(),
        ]);

        let directories = directories_for_paths(&paths);
        assert_eq!(directories.len(), 2);
        assert!(directories.contains(&PathBuf::from("/tmp/a")));
        assert!(directories.contains(&PathBuf::from("/tmp/b")));
    }

    #[test]
    fn matches_only_exact_watched_files() {
        let paths = normalize_paths(vec!["/tmp/config.json".to_string()]);

        assert_eq!(
            matching_watched_path(&paths, &PathBuf::from("/tmp/config.json")),
            Some(PathBuf::from("/tmp/config.json"))
        );
        assert_eq!(matching_watched_path(&paths, &PathBuf::from("/tmp/other.json")), None);
    }

    #[test]
    fn suppresses_duplicate_events_for_a_short_window() {
        let path = PathBuf::from("/tmp/config.json");
        let mut last_emitted_at = HashMap::new();

        assert!(should_emit(&mut last_emitted_at, &path));
        assert!(!should_emit(&mut last_emitted_at, &path));
    }
}
