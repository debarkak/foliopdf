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

fn startup_pdf_path() -> Option<std::path::PathBuf> {
    let path = std::path::PathBuf::from(std::env::args_os().nth(1)?);
    path.extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
        .then_some(path)
}

#[tauri::command]
fn startup_pdf_name() -> Option<String> {
    Some(startup_pdf_path()?.file_name()?.to_string_lossy().into_owned())
}

#[tauri::command]
async fn read_startup_pdf() -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let path = startup_pdf_path().ok_or("No PDF supplied")?;
        if !path.is_file() {
            return Err("The PDF is not a readable file".to_string());
        }
        std::fs::read(path)
            .map(tauri::ipc::Response::new)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![update_install_supported, enable_backdrop, startup_pdf_name, read_startup_pdf])
        .run(tauri::generate_context!())
        .expect("failed to start foliopdf");
}
