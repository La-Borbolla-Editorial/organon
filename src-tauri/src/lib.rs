//! Núcleo nativo de Organon. Un proyecto es una carpeta cualquiera del
//! usuario con `organon.json`, `fuentes.json`, `fichas.json` y `pdfs/`.
//! Toda la lógica vive en el frontend; aquí solo se leen y escriben archivos
//! del proyecto abierto.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};
use tauri::{ipc::InvokeBody, AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct Current(Mutex<Option<PathBuf>>);

#[derive(Serialize)]
struct Project {
    path: String,
    name: String,
    exists: bool,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn describe(path: &Path) -> Project {
    Project {
        path: path.to_string_lossy().into_owned(),
        name: path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        exists: path.is_dir(),
    }
}

fn current(state: &State<'_, Current>) -> Result<PathBuf, String> {
    state.0.lock().map_err(err)?.clone().ok_or_else(|| "No hay ningún proyecto abierto".to_string())
}

// ---- Proyectos recientes ---------------------------------------------------

fn recents_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(err)?;
    fs::create_dir_all(&dir).map_err(err)?;
    Ok(dir.join("recientes.json"))
}

fn read_recents(app: &AppHandle) -> Vec<String> {
    recents_file(app)
        .ok()
        .and_then(|f| fs::read_to_string(f).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_recents(app: &AppHandle, list: &[String]) -> Result<(), String> {
    fs::write(recents_file(app)?, serde_json::to_string_pretty(list).map_err(err)?).map_err(err)
}

#[tauri::command]
fn recent_projects(app: AppHandle) -> Vec<Project> {
    read_recents(&app).iter().map(|p| describe(Path::new(p))).collect()
}

#[tauri::command]
fn forget_project(app: AppHandle, path: String) -> Result<(), String> {
    let list: Vec<String> = read_recents(&app).into_iter().filter(|p| *p != path).collect();
    write_recents(&app, &list)
}

#[tauri::command]
fn current_project(state: State<'_, Current>) -> Result<Option<Project>, String> {
    Ok(state.0.lock().map_err(err)?.as_deref().map(describe))
}

/// Muestra el selector de carpetas del sistema.
#[tauri::command]
async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    match app.dialog().file().set_title("Elige la carpeta del proyecto").blocking_pick_folder() {
        Some(p) => Ok(Some(p.into_path().map_err(err)?.to_string_lossy().into_owned())),
        None => Ok(None),
    }
}

/// Abre (o inicia) un proyecto en `path` y lo pone el primero de los recientes.
#[tauri::command]
fn open_project(app: AppHandle, state: State<'_, Current>, path: String) -> Result<Project, String> {
    let dir = PathBuf::from(&path);
    if !dir.is_absolute() {
        return Err("La ruta del proyecto debe ser absoluta".into());
    }
    fs::create_dir_all(dir.join("pdfs")).map_err(err)?;
    let mut list = read_recents(&app);
    list.retain(|p| *p != path);
    list.insert(0, path);
    list.truncate(15);
    write_recents(&app, &list)?;
    *state.0.lock().map_err(err)? = Some(dir.clone());
    Ok(describe(&dir))
}

#[tauri::command]
fn close_project(state: State<'_, Current>) -> Result<(), String> {
    *state.0.lock().map_err(err)? = None;
    Ok(())
}

// ---- Archivos del proyecto ---------------------------------------------------

fn safe_name(name: &str, ext: &str) -> Result<(), String> {
    let ok = name.ends_with(ext)
        && !name.starts_with('.')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if ok { Ok(()) } else { Err(format!("Nombre de archivo no válido: {name}")) }
}

/// Lee un archivo .json de la raíz del proyecto. `None` si aún no existe.
#[tauri::command]
fn read_data(state: State<'_, Current>, name: String) -> Result<Option<String>, String> {
    safe_name(&name, ".json")?;
    let path = current(&state)?.join(&name);
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(err)
}

#[derive(Deserialize)]
struct DataFile {
    name: String,
    content: String,
}

/// Escribe uno o varios .json del proyecto. Primero se escriben todos en
/// archivos temporales y solo entonces se renombran, para no dejar nunca un
/// archivo a medias.
#[tauri::command]
fn write_data(state: State<'_, Current>, files: Vec<DataFile>) -> Result<(), String> {
    let dir = current(&state)?;
    for f in &files {
        safe_name(&f.name, ".json")?;
    }
    for f in &files {
        fs::write(dir.join(format!("{}.tmp", f.name)), &f.content).map_err(err)?;
    }
    for f in &files {
        fs::rename(dir.join(format!("{}.tmp", f.name)), dir.join(&f.name)).map_err(err)?;
    }
    Ok(())
}

/// Guarda un PDF en `pdfs/`. El cuerpo es el archivo en bruto y el nombre
/// viaja en la cabecera `x-name`.
#[tauri::command]
fn save_pdf(state: State<'_, Current>, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let name = request
        .headers()
        .get("x-name")
        .and_then(|v| v.to_str().ok())
        .ok_or("Falta la cabecera x-name")?;
    safe_name(name, ".pdf")?;
    let path = current(&state)?.join("pdfs").join(name);
    match request.body() {
        InvokeBody::Raw(bytes) => fs::write(path, bytes).map_err(err),
        _ => Err("Se esperaba un cuerpo binario".into()),
    }
}

#[tauri::command]
fn read_pdf(state: State<'_, Current>, name: String) -> Result<tauri::ipc::Response, String> {
    safe_name(&name, ".pdf")?;
    fs::read(current(&state)?.join("pdfs").join(name)).map(tauri::ipc::Response::new).map_err(err)
}

/// Guarda un archivo de texto donde elija el usuario. Devuelve `false` si cancela.
#[tauri::command]
async fn save_text_file(app: AppHandle, default_name: String, content: String) -> Result<bool, String> {
    match app.dialog().file().set_file_name(&default_name).blocking_save_file() {
        Some(p) => fs::write(p.into_path().map_err(err)?, content).map(|_| true).map_err(err),
        None => Ok(false),
    }
}

/// Abre un enlace web en el navegador del sistema.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("Solo se abren enlaces https".into());
    }
    std::process::Command::new("open").arg(&url).spawn().map(|_| ()).map_err(err)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Current::default())
        .invoke_handler(tauri::generate_handler![
            recent_projects, forget_project, current_project, pick_folder, open_project, close_project,
            read_data, write_data, save_pdf, read_pdf, save_text_file, open_url
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Organon");
}
