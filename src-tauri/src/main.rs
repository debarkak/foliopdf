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

#[tauri::command]
fn enable_backdrop(window: tauri::WebviewWindow) -> bool {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMSBT_MAINWINDOW, DWMWA_SYSTEMBACKDROP_TYPE};
        let Ok(handle) = window.hwnd() else { return false };
        let backdrop = DWMSBT_MAINWINDOW;
        // The system returns an error on Windows versions without this backdrop.
        unsafe {
            DwmSetWindowAttribute(handle.0 as _, DWMWA_SYSTEMBACKDROP_TYPE as _, &backdrop as *const _ as _, std::mem::size_of_val(&backdrop) as _) >= 0
        }
    }
    #[cfg(not(windows))]
    { let _ = window; false }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![update_install_supported, enable_backdrop])
        .run(tauri::generate_context!())
        .expect("failed to start foliopdf");
}
