//! Desktop (Windows/macOS) bootstrap: spawn the Node local-api sidecar.
//! This file is compiled only on non-Android targets.

use std::{
    fs::{self, OpenOptions},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};

use tauri::{path::BaseDirectory, Manager};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub const LOCAL_API_PORT: &str = "4318";

/// CREATE_NO_WINDOW (0x08000000): keep the sidecar console from flashing
/// a terminal window on Windows. No-op on other platforms.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Tauri's path resolver returns verbatim (`\\?\`) paths on Windows, which
/// Node's CJS main-module loader mishandles. Strip the prefix.
fn normalize_win_path(value: &std::path::Path) -> std::path::PathBuf {
    let s = value.to_string_lossy();
    let normalized = if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = s.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        s.to_string()
    };
    std::path::PathBuf::from(normalized)
}

pub struct LocalApiState(pub Mutex<Option<Child>>);

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

fn resolve_node_binary(app: &tauri::App) -> String {
    if let Some(explicit) = std::env::var("LOCAL_API_NODE_BIN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        return explicit;
    }

    #[cfg(windows)]
    {
        // Production Windows builds ship a portable Node runtime next to the
        // app resources so the user does not need to install Node.js.
        if let Ok(bundled) = app
            .path()
            .resolve("node/node.exe", BaseDirectory::Resource)
        {
            if bundled.exists() {
                return bundled.to_string_lossy().into_owned();
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
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
    }

    "node".to_string()
}

fn spawn_local_api(app: &tauri::App) -> Result<Child, String> {
    let script_path = normalize_win_path(&resolve_local_api_script(app)?);
    let node_binary = normalize_win_path(&std::path::PathBuf::from(resolve_node_binary(app)));
    let data_dir = normalize_win_path(&app.path().app_local_data_dir().map_err(|err| err.to_string())?);
    fs::create_dir_all(&data_dir).map_err(|err| err.to_string())?;

    if let Ok(mut diag) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(data_dir.join("local-api.spawn.log"))
    {
        use std::io::Write;
        let _ = writeln!(
            diag,
            "[tauri] cwd={:?} node={} script={}",
            std::env::current_dir().unwrap_or_default(),
            node_binary.display(),
            script_path.display()
        );
    }

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

    let mut command = Command::new(resolve_node_binary(app));
    command
        .arg(script_path)
        .env("LOCAL_API_PORT", LOCAL_API_PORT)
        .env("LOCAL_APP_DATA_DIR", &data_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout_log))
        .stderr(Stdio::from(stderr_log));

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let child = command.spawn();

    child.map_err(|err| format!("failed to spawn local-api: {err}"))
}

/// Wait briefly for the sidecar /health endpoint, then report the outcome.
fn wait_for_local_api(data_dir: &std::path::Path, port: &str, child: &mut Child) {
    let url = format!("http://127.0.0.1:{port}/health");
    let mut ready = false;

    for _ in 0..40 {
        if let Ok(Some(status)) = child.try_wait() {
            let stderr_path = data_dir.join("local-api.stderr.log");
            eprintln!(
                "local-api exited early (status {status}). Check {} for the error. \
                 If the error mentions EADDRINUSE, another 看看收藏 instance is already running.",
                stderr_path.display()
            );
            return;
        }

        if let Ok(response) = std::net::TcpStream::connect_timeout(
            &format!("127.0.0.1:{port}").parse().unwrap_or_else(|_| {
                std::net::SocketAddr::from(([127, 0, 0, 1], 4318))
            }),
            std::time::Duration::from_millis(250),
        ) {
            drop(response);
            ready = true;
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(150));
    }

    if ready {
        eprintln!("local-api ready at {url}");
    } else {
        eprintln!(
            "local-api did not become ready within the startup window ({url}). \
             Check {} for details.",
            data_dir.join("local-api.stderr.log").display(),
        );
    }
}

/// Desktop bootstrap hook: spawn the Node sidecar (unchanged desktop behavior).
pub fn setup_local_api(app: &tauri::App) {
    match spawn_local_api(app) {
        Ok(mut child) => {
            let data_dir = app.path().app_local_data_dir().map_err(|err| err.to_string());
            if let Ok(dir) = &data_dir {
                wait_for_local_api(dir, LOCAL_API_PORT, &mut child);
            }
            app.manage(LocalApiState(Mutex::new(Some(child))));
        }
        Err(err) => {
            eprintln!("{err}");
            if let Ok(dir) = app.path().app_local_data_dir() {
                let dir = normalize_win_path(&dir);
                let _ = fs::create_dir_all(&dir);
                if let Ok(mut log) = OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(dir.join("local-api.stderr.log"))
                {
                    use std::io::Write;
                    let _ = writeln!(log, "[tauri] {err}");
                }
            }
        }
    }
}

/// Kill the sidecar on exit (desktop only).
pub fn cleanup_local_api(app_handle: &tauri::AppHandle) {
    if let Some(state) = app_handle.try_state::<LocalApiState>() {
        if let Ok(mut child) = state.0.lock() {
            if let Some(process) = child.as_mut() {
                let _ = process.kill();
            }
            *child = None;
        }
    }
}

/// Human-readable bootstrap status for the UI.
pub fn bootstrap_summary() -> &'static str {
    "DESKTOP CORE READY"
}
