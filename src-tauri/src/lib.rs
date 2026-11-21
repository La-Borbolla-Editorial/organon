//! Núcleo nativo de Organon. Un proyecto es una carpeta cualquiera del
//! usuario con `organon.json`, `fuentes.json`, `fichas.json` y `pdfs/`.
//! Toda la lógica vive en el frontend; aquí solo se leen y escriben archivos
//! del proyecto abierto.

use std::{
    collections::HashMap,
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

/// Sello de un archivo (fecha de modificación y tamaño) para saber si alguien
/// lo cambió fuera de Organon. `None` si no existe.
fn stamp(path: &Path) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?;
    Some(format!("{}-{}", modified.as_nanos(), meta.len()))
}

#[tauri::command]
fn data_stamps(state: State<'_, Current>, names: Vec<String>) -> Result<HashMap<String, Option<String>>, String> {
    let dir = current(&state)?;
    let mut out = HashMap::new();
    for name in names {
        safe_name(&name, ".json")?;
        let s = stamp(&dir.join(&name));
        out.insert(name, s);
    }
    Ok(out)
}

/// Escribe uno o varios .json del proyecto y devuelve sus sellos nuevos.
/// `expected` son los sellos que Organon vio por última vez: si alguno ya no
/// coincide, el archivo cambió fuera de la app y no se escribe nada
/// (el error empieza por `CONFLICT`). Primero se escriben todos en archivos
/// temporales y solo entonces se renombran, para no dejar ninguno a medias.
#[tauri::command]
fn write_data(state: State<'_, Current>, files: Vec<DataFile>, expected: HashMap<String, Option<String>>) -> Result<HashMap<String, Option<String>>, String> {
    let dir = current(&state)?;
    for f in &files {
        safe_name(&f.name, ".json")?;
    }
    for (name, seen) in &expected {
        safe_name(name, ".json")?;
        if stamp(&dir.join(name)) != *seen {
            return Err(format!("CONFLICT {name}"));
        }
    }
    for f in &files {
        fs::write(dir.join(format!("{}.tmp", f.name)), &f.content).map_err(err)?;
    }
    let mut out = HashMap::new();
    for f in &files {
        fs::rename(dir.join(format!("{}.tmp", f.name)), dir.join(&f.name)).map_err(err)?;
        out.insert(f.name.clone(), stamp(&dir.join(&f.name)));
    }
    Ok(out)
}

// ---- Borradores (escritura/*.md) -------------------------------------------------

#[derive(Serialize)]
struct Draft {
    name: String,
    stamp: Option<String>,
}

#[derive(Serialize)]
struct DraftContent {
    content: String,
    stamp: Option<String>,
}

/// Nombre de borrador: lo que el usuario escriba (con acentos y espacios),
/// pero sin separadores de ruta ni puntos iniciales.
fn draft_path(dir: &Path, name: &str) -> Result<PathBuf, String> {
    let ok = !name.trim().is_empty()
        && name.len() <= 120
        && !name.starts_with('.')
        && !name.chars().any(|c| matches!(c, '/' | '\\' | ':' | '\0') || c.is_control());
    if !ok {
        return Err(format!("Nombre de texto no válido: {name}"));
    }
    Ok(dir.join("escritura").join(format!("{name}.md")))
}

/// Además, para un nombre NUEVO (al crear o renombrar un texto): que valga también en Windows,
/// donde el proyecto puede acabar sincronizado. Los textos que ya existen se siguen abriendo.
fn check_new_draft_name(name: &str) -> Result<(), String> {
    if name.chars().any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')) {
        return Err("Un nombre de texto no puede llevar ninguno de estos signos: / \\ : * ? \" < > |".into());
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return Err("Un nombre de texto no puede terminar en punto ni en espacio.".into());
    }
    let stem = name.split('.').next().unwrap_or("").trim().to_ascii_uppercase();
    let numbered = (stem.starts_with("COM") || stem.starts_with("LPT")) && stem.len() == 4 && matches!(stem.as_bytes()[3], b'1'..=b'9');
    if matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL") || numbered {
        return Err(format!("«{name}» es un nombre reservado en Windows: elige otro."));
    }
    Ok(())
}

#[tauri::command]
fn list_drafts(state: State<'_, Current>) -> Result<Vec<Draft>, String> {
    let dir = current(&state)?.join("escritura");
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file = entry.file_name().to_string_lossy().into_owned();
            if path.is_file() && !file.starts_with('.') && file.ends_with(".md") {
                out.push(Draft { name: file[..file.len() - 3].to_string(), stamp: stamp(&path) });
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[tauri::command]
fn read_draft(state: State<'_, Current>, name: String) -> Result<DraftContent, String> {
    let path = draft_path(&current(&state)?, &name)?;
    Ok(DraftContent { content: fs::read_to_string(&path).map_err(err)?, stamp: stamp(&path) })
}

/// Guarda un borrador. `expected` es el sello con el que se leyó (`None` si es
/// nuevo): si el archivo ya no lo tiene, cambió fuera de Organon y no se
/// escribe (error `CONFLICT`). Con `force` se escribe igualmente.
#[tauri::command]
fn write_draft(state: State<'_, Current>, name: String, content: String, expected: Option<String>, force: bool) -> Result<Option<String>, String> {
    let dir = current(&state)?;
    let path = draft_path(&dir, &name)?;
    if !path.exists() {
        check_new_draft_name(&name)?;
    }
    if !force && stamp(&path) != expected {
        return Err(format!("CONFLICT {name}"));
    }
    fs::create_dir_all(dir.join("escritura")).map_err(err)?;
    let tmp = dir.join("escritura").join(format!(".{name}.tmp"));
    fs::write(&tmp, content).map_err(err)?;
    fs::rename(&tmp, &path).map_err(err)?;
    Ok(stamp(&path))
}

#[tauri::command]
fn rename_draft(state: State<'_, Current>, from: String, to: String) -> Result<(), String> {
    let dir = current(&state)?;
    check_new_draft_name(&to)?;
    let source = draft_path(&dir, &from)?;
    let target = draft_path(&dir, &to)?;
    if target.exists() {
        // En macOS y Windows «Prueba» y «prueba» son el mismo archivo: cambiar solo mayúsculas
        // no choca con nada (salvo que de verdad haya otro archivo con ese nombre exacto).
        let exact = format!("{to}.md");
        let other = fs::read_dir(dir.join("escritura")).map_err(err)?.flatten().any(|e| e.file_name().to_string_lossy() == exact);
        if other || from.to_lowercase() != to.to_lowercase() {
            return Err(format!("Ya existe un texto llamado «{to}»"));
        }
        let step = dir.join("escritura").join(format!(".{from}.renombrando"));
        fs::rename(&source, &step).map_err(err)?;
        return fs::rename(&step, target).map_err(err);
    }
    fs::rename(source, target).map_err(err)
}

/// No borra: mueve el borrador a `escritura/.papelera/`.
#[tauri::command]
fn trash_draft(state: State<'_, Current>, name: String) -> Result<(), String> {
    let dir = current(&state)?;
    let trash = dir.join("escritura").join(".papelera");
    fs::create_dir_all(&trash).map_err(err)?;
    let when = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(err)?.as_secs();
    fs::rename(draft_path(&dir, &name)?, trash.join(format!("{name} ({when}).md"))).map_err(err)
}

/// Guarda un archivo binario (p. ej. un .docx exportado) donde elija el usuario.
#[tauri::command]
async fn save_binary_file(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<bool, String> {
    let name = request.headers().get("x-name").and_then(|v| v.to_str().ok()).map(|s| percent_decode(s)).ok_or("Falta la cabecera x-name")?;
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("Se esperaba un cuerpo binario".into()),
    };
    match app.dialog().file().set_file_name(&name).blocking_save_file() {
        Some(p) => fs::write(p.into_path().map_err(err)?, bytes).map(|_| true).map_err(err),
        None => Ok(false),
    }
}

/// Decodifica %XX (los nombres con acentos viajan codificados en la cabecera).
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let hex = |b: u8| (b as char).to_digit(16).map(|d| d as u8);
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push(hi * 16 + lo);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
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

/// No borra: mueve el PDF a `pdfs/.papelera/` (la fuente se queda sin PDF).
#[tauri::command]
fn trash_pdf(state: State<'_, Current>, name: String) -> Result<(), String> {
    safe_name(&name, ".pdf")?;
    let pdfs = current(&state)?.join("pdfs");
    let trash = pdfs.join(".papelera");
    fs::create_dir_all(&trash).map_err(err)?;
    let when = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(err)?.as_secs();
    let stem = name.trim_end_matches(".pdf");
    fs::rename(pdfs.join(&name), trash.join(format!("{stem} ({when}).pdf"))).map_err(err)
}

/// Lo que hay en una papelera del proyecto.
#[derive(Serialize)]
struct TrashBin {
    count: usize,
    bytes: u64,
}

#[derive(Serialize)]
struct TrashInfo {
    pdfs: TrashBin,
    escritura: TrashBin,
}

fn trash_dir(dir: &Path, which: &str) -> Result<PathBuf, String> {
    match which {
        "pdfs" | "escritura" => Ok(dir.join(which).join(".papelera")),
        _ => Err(format!("Papelera desconocida: {which}")),
    }
}

fn trash_files(trash: &Path) -> Vec<fs::DirEntry> {
    fs::read_dir(trash)
        .map(|rd| rd.filter_map(Result::ok).filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false)).collect())
        .unwrap_or_default()
}

fn trash_bin(trash: &Path) -> TrashBin {
    let files = trash_files(trash);
    TrashBin { count: files.len(), bytes: files.iter().filter_map(|e| e.metadata().ok()).map(|m| m.len()).sum() }
}

#[tauri::command]
fn trash_info(state: State<'_, Current>) -> Result<TrashInfo, String> {
    let dir = current(&state)?;
    Ok(TrashInfo { pdfs: trash_bin(&trash_dir(&dir, "pdfs")?), escritura: trash_bin(&trash_dir(&dir, "escritura")?) })
}

/// Borra de verdad lo que hay en una papelera del proyecto (`pdfs` o `escritura`).
#[tauri::command]
fn empty_trash(state: State<'_, Current>, which: String) -> Result<(), String> {
    let trash = trash_dir(&current(&state)?, &which)?;
    for e in trash_files(&trash) {
        fs::remove_file(e.path()).map_err(err)?;
    }
    Ok(())
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

/// Abre el diálogo de impresión del sistema (desde ahí se guarda como PDF).
#[tauri::command]
fn print_page(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(err)
}

/// Abre un enlace o una carpeta con la aplicación del sistema (navegador, Finder, Explorador).
fn open_with_system(target: &std::ffi::OsStr) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut cmd = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut cmd = if target.to_string_lossy().starts_with("https://") {
        // Sin pasar por cmd.exe: así un «&» en la dirección no se interpreta.
        let mut c = std::process::Command::new("rundll32");
        c.arg("url.dll,FileProtocolHandler");
        c
    } else {
        std::process::Command::new("explorer")
    };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut cmd = std::process::Command::new("xdg-open");
    cmd.arg(target).spawn().map(|_| ()).map_err(err)
}

/// Abre un enlace web en el navegador del sistema.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("Solo se abren enlaces https".into());
    }
    open_with_system(url.as_ref())
}

// ---- Ajustes de Organon y temas (en la carpeta de configuración de la app) -----

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(err)?;
    fs::create_dir_all(&dir).map_err(err)?;
    Ok(dir)
}

fn themes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = config_dir(app)?.join("temas");
    fs::create_dir_all(&dir).map_err(err)?;
    Ok(dir)
}

/// `ajustes.json` de Organon (no del proyecto). `None` si aún no existe.
#[tauri::command]
fn read_app_settings(app: AppHandle) -> Result<Option<String>, String> {
    let path = config_dir(&app)?.join("ajustes.json");
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(err)
}

#[tauri::command]
fn write_app_settings(app: AppHandle, content: String) -> Result<(), String> {
    let path = config_dir(&app)?.join("ajustes.json");
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, content).map_err(err)?;
    fs::rename(tmp, path).map_err(err)
}

#[derive(Serialize)]
struct ThemeFile {
    file: String,
    content: String,
}

/// Los temas del usuario: cada .json de la carpeta `temas/`.
#[tauri::command]
fn list_themes(app: AppHandle) -> Result<Vec<ThemeFile>, String> {
    let mut out = Vec::new();
    for entry in fs::read_dir(themes_dir(&app)?).map_err(err)? {
        let path = entry.map_err(err)?.path();
        let file = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        if safe_name(&file, ".json").is_err() {
            continue;
        }
        if let Ok(content) = fs::read_to_string(&path) {
            out.push(ThemeFile { file, content });
        }
    }
    out.sort_by(|a, b| a.file.cmp(&b.file));
    Ok(out)
}

#[tauri::command]
fn write_theme(app: AppHandle, file: String, content: String) -> Result<(), String> {
    safe_name(&file, ".json")?;
    fs::write(themes_dir(&app)?.join(file), content).map_err(err)
}

#[tauri::command]
fn delete_theme(app: AppHandle, file: String) -> Result<(), String> {
    safe_name(&file, ".json")?;
    fs::remove_file(themes_dir(&app)?.join(file)).map_err(err)
}

/// Abre la carpeta de temas en el Finder (o el Explorador de Windows).
#[tauri::command]
fn reveal_themes_folder(app: AppHandle) -> Result<(), String> {
    open_with_system(themes_dir(&app)?.as_os_str())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Current::default())
        .invoke_handler(tauri::generate_handler![
            recent_projects, forget_project, current_project, pick_folder, open_project, close_project,
            read_data, data_stamps, write_data, list_drafts, read_draft, write_draft, rename_draft, trash_draft, save_binary_file, print_page, save_pdf, read_pdf, trash_pdf, trash_info, empty_trash, save_text_file, open_url,
            read_app_settings, write_app_settings, list_themes, write_theme, delete_theme, reveal_themes_folder
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Organon");
}
