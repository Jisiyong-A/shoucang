//! 看看收藏 app core.
//!
//! Shared by desktop (bin entry) and Android (mobile entry point via JNI).
//! The mobile `cfg` is emitted by tauri-build when targeting android/ios.

mod commands;
mod platform;

use platform::setup_local_api;
#[cfg(not(target_os = "android"))]
use platform::cleanup_local_api;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            setup_local_api(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_platform_info,
            commands::get_app_data_dir,
            commands::health,
            commands::bootstrap_status,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        #[cfg(not(target_os = "android"))]
        {
            if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
                cleanup_local_api(app_handle);
            }
        }
        #[cfg(target_os = "android")]
        {
            let _ = (app_handle, event);
        }
    });
}
