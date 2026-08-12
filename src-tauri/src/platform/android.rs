//! Android platform bootstrap.
//!
//! No Node sidecar, no localhost:4318. The Android app is fully native:
//! React static UI <-> Tauri commands <-> Rust core (SQLite/ONNX later).
//! This module intentionally has no business logic — only lifecycle hooks.

use std::process::Child;

/// Placeholder for the desktop child-process state type (kept for the shared
/// `main.rs` run-event cleanup signature; never populated on Android).
#[derive(Default)]
#[allow(dead_code)]
pub struct LocalApiState(pub std::sync::Mutex<Option<Child>>);

/// Android bootstrap hook: nothing to spawn. Keep it explicit so nobody
/// accidentally reintroduces a Node dependency on Android.
pub fn setup_local_api(_app: &tauri::App) {
    // Intentionally empty — see module doc comment.
}

/// Human-readable bootstrap status used by the UI (ANDROID CORE READY).
pub fn bootstrap_summary() -> &'static str {
    "ANDROID CORE READY"
}
