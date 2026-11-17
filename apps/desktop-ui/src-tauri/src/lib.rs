use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn get_auth_token() -> String {
  let home = std::env::var_os("USERPROFILE")
    .or_else(|| std::env::var_os("HOME"));
  let Some(home) = home else {
    return String::new();
  };
  let path = std::path::PathBuf::from(home)
    .join(".codepilot-local")
    .join("auth.token");
  std::fs::read_to_string(path).unwrap_or_default().trim().to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![get_auth_token])
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // CodePilot Local Server চালু করুন
      let sidecar_command = app.shell().sidecar("local-server").unwrap();
      let (mut _rx, mut _child) = sidecar_command.spawn().expect("Failed to start local server");

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}