// The native host stays intentionally thin; product logic remains in the existing web app.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Castle Draft League");
}
