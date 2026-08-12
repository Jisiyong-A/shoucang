//! Platform separation for 看看收藏.
//!
//! Desktop (Windows/macOS): spawns the Node `local-api.mjs` sidecar (HTTP :4318).
//! Android: no Node runtime, no sidecar — the Rust core owns storage/search,
//! so the desktop spawn logic is compiled out entirely.

#[cfg(not(target_os = "android"))]
pub mod desktop;

#[cfg(target_os = "android")]
pub mod android;

#[cfg(not(target_os = "android"))]
pub use desktop::{bootstrap_summary, cleanup_local_api, setup_local_api};

#[cfg(target_os = "android")]
pub use android::{LocalApiState, bootstrap_summary, setup_local_api};
