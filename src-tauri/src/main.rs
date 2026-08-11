#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs::{self, OpenOptions},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};

use tauri::{path::BaseDirectory, Manager};

const LOCAL_API_PORT: &str = "4318";

struct LocalApiState(Mutex<Option<Child>>);

fn resolve_local_api_script(app: &tauri::App) -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|err| err.to_string())?;
    let candidates = [
        cwd.join("scripts/local-api.mjs"),
        cwd.join("../scripts/local-api.mjs"),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    let bundled = app
        .path()
        .resolve("local-api.mjs", BaseDirectory::Resource)
        .map_err(|err| err.to_string())?;
    if bundled.exists() {
        return Ok(bundled);
    }

    Err("local-api.mjs not found".to_string())
}

fn resolve_node_binary() -> String {
    if let Some(explicit) = std::env::var("LOCAL_API_NODE_BIN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        return explicit;
    }

    let candidates = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];

    for candidate in candidates {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return candidate.to_string();
        }
    }

    "node".to_string()
}

fn spawn_local_api(app: &tauri::App) -> Result<Child, String> {
    let script_path = resolve_local_api_script(app)?;
    let data_dir = app.path().app_local_data_dir().map_err(|err| err.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|err| err.to_string())?;

    let stdout_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(data_dir.join("local-api.stdout.log"))
        .map_err(|err| err.to_string())?;
    let stderr_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(data_dir.join("local-api.stderr.log"))
        .map_err(|err| err.to_string())?;

    let child = Command::new(resolve_node_binary())
        .arg(script_path)
        .env("LOCAL_API_PORT", LOCAL_API_PORT)
        .env("LOCAL_APP_DATA_DIR", &data_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout_log))
        .stderr(Stdio::from(stderr_log))
        .spawn();

    child.map_err(|err| format!("failed to spawn local-api: {err}"))
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            match spawn_local_api(app) {
                Ok(child) => {
                    app.manage(LocalApiState(Mutex::new(Some(child))));
                }
                Err(err) => {
                    eprintln!("{err}");
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
            if let Some(state) = app_handle.try_state::<LocalApiState>() {
                if let Ok(mut child) = state.0.lock() {
                    if let Some(process) = child.as_mut() {
                        let _ = process.kill();
                    }
                    *child = None;
                }
            }
        }
    });
}
