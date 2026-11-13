#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_fs::FsExt;

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
    std::env::args_os().skip(1).map(std::path::PathBuf::from).find(|path| {
        path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
            && path.is_file()
    })
}

#[tauri::command]
fn startup_pdf_info() -> Option<serde_json::Value> {
    let path = startup_pdf_path()?;
    Some(serde_json::json!({ "name": path.file_name()?.to_string_lossy(), "path": path }))
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

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct RecentPdf {
    name: String,
    path: std::path::PathBuf,
    opened: u64,
}

static HISTORY_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn history_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app.path().app_local_data_dir().map_err(|error| error.to_string())?.join("recent-pdfs.json"))
}

fn read_history(file: &std::path::Path) -> Vec<RecentPdf> {
    std::fs::read(file).ok().and_then(|data| serde_json::from_slice(&data).ok()).unwrap_or_default()
}

#[tauri::command]
fn recent_pdfs(app: tauri::AppHandle, keep_days: u32, path: Option<std::path::PathBuf>) -> Result<Vec<RecentPdf>, String> {
    let _lock = HISTORY_LOCK.lock().map_err(|error| error.to_string())?;
    let file = history_file(&app)?;
    if keep_days == 0 {
        match std::fs::remove_file(file) {
            Ok(()) => {},
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {},
            Err(error) => return Err(error.to_string()),
        }
        return Ok(Vec::new());
    }
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|error| error.to_string())?.as_secs();
    let cutoff = now.saturating_sub(u64::from(keep_days.min(365)) * 86_400);
    let mut entries = read_history(&file);
    entries.retain(|entry| entry.opened >= cutoff);
    if let Some(path) = path {
        let authorized = app.fs_scope().is_allowed(&path)
            || startup_pdf_path().as_ref() == Some(&path)
            || entries.iter().any(|entry| entry.path == path);
        if authorized && path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("pdf")) {
            if let Some(name) = path.file_name().map(|name| name.to_string_lossy().into_owned()) {
                entries.retain(|entry| entry.path != path);
                entries.insert(0, RecentPdf { name, path, opened: now });
            }
        }
    }
    std::fs::create_dir_all(file.parent().ok_or("Invalid history location")?).map_err(|error| error.to_string())?;
    std::fs::write(file, serde_json::to_vec(&entries).map_err(|error| error.to_string())?).map_err(|error| error.to_string())?;
    Ok(entries)
}

#[tauri::command]
async fn read_recent_pdf(app: tauri::AppHandle, path: std::path::PathBuf) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = HISTORY_LOCK.lock().map_err(|error| error.to_string())?;
        if !read_history(&history_file(&app)?).iter().any(|entry| entry.path == path) || !path.is_file() {
            return Err("Recent PDF is unavailable".to_string());
        }
        std::fs::read(path).map(tauri::ipc::Response::new).map_err(|error| error.to_string())
    }).await.map_err(|error| error.to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![update_install_supported, enable_backdrop, startup_pdf_info, read_startup_pdf, recent_pdfs, read_recent_pdf])
        .run(tauri::generate_context!())
        .expect("failed to start foliopdf");
}
