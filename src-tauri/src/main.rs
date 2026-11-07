#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn update_install_supported() -> bool {
    use tauri::utils::{config::BundleType, platform::bundle_type};
    match bundle_type() {
        Some(BundleType::AppImage) => std::env::var_os("APPIMAGE").is_some(),
        Some(BundleType::Nsis) => std::env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(|parent| parent.join("uninstall.exe")))
            .is_some_and(|path| path.is_file()),
        _ => false,
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![update_install_supported])
        .run(tauri::generate_context!())
        .expect("failed to start foliopdf");
}
