//! Minimal Tauri commands shared by all platforms (Task 03 §6).

use tauri::Manager;

/// Platform identity used by the UI bootstrap status.
#[tauri::command]
pub fn get_platform_info() -> String {
    if cfg!(target_os = "android") {
        format!("android-{}", std::env::consts::ARCH)
    } else {
        format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH)
    }
}

/// App data directory (writable). Android resolves to `filesDir`; desktop to
/// the local app data dir. Everything persistent must live under this root.
#[tauri::command]
pub fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|err| err.to_string())
}

/// Liveness probe for the UI / watchdog.
#[tauri::command]
pub fn health() -> &'static str {
    "ok"
}

/// Bootstrap status string (ANDROID CORE READY / DESKTOP CORE READY).
#[tauri::command]
pub fn bootstrap_status() -> &'static str {
    crate::platform::bootstrap_summary()
}
