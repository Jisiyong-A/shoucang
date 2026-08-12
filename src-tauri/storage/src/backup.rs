//! Backup / export / desktop interop (Task 12).
//!
//! `.kankan-backup` is a ZIP whose core is:
//!   manifest.json     — format version, timestamps, model versions
//!   notes.json        — desktop-compatible note schema (mapping fields)
//!   media/            — optional full-backup image files
//!   checksums.json    — SHA-256 of every payload file
//!
//! This module produces/consumes the directory form; ZIP packaging is done
//! by the platform layer (Kotlin/zip crate). Embeddings are NOT exported
//! (rebuildable, model-version dependent, large) — manifest records the
//! text model id so reindex can be scheduled after import.

use std::collections::HashMap;
use std::io::Read;
use std::path::Path;

use rusqlite::params;
use sha2::{Digest, Sha256};

use super::notes::{import_note, NewImage, NewNote};
use super::store::{Store, StoreError};

pub const BACKUP_FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Manifest {
    pub format_version: u32,
    pub exported_at_epoch_secs: u64,
    pub app_version: String,
    pub note_count: usize,
    pub media_included: bool,
    pub text_model_id: Option<String>,
    pub image_model_id: Option<String>,
}

/// Desktop-compatible note row (field names mirror the original notes.json).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackupNote {
    pub id: String,
    #[serde(default)]
    pub sourceUrl: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub rawContent: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub authorId: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub savedAt: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub imageUrls: Vec<String>,
    #[serde(default)]
    pub ocrText: String,
    #[serde(default)]
    pub mediaStatus: String,
}

fn collect_backup_notes(store: &Store) -> Result<Vec<BackupNote>, StoreError> {
    let mut stmt = store
        .conn()
        .prepare("SELECT id, source_url, title, raw_content, author_name, author_id,
                         category, saved_at
                  FROM notes ORDER BY saved_at DESC")?;
    let mut notes = stmt
        .query_map([], |row| {
            Ok(BackupNote {
                id: row.get(0)?,
                sourceUrl: row.get(1)?,
                title: row.get(2)?,
                rawContent: row.get(3)?,
                author: row.get(4)?,
                authorId: row.get(5)?,
                category: row.get(6)?,
                savedAt: row.get(7)?,
                tags: Vec::new(),
                imageUrls: Vec::new(),
                ocrText: String::new(),
                mediaStatus: "ready".to_string(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    for note in &mut notes {
        let tags: Vec<String> = {
            let mut st = store.conn().prepare(
                "SELECT t.name FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
                 WHERE nt.note_id = ?1",
            )?;
            let rows = st.query_map([&note.id], |r| r.get(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        let images: Vec<(String, String)> = {
            let mut st = store.conn().prepare(
                "SELECT local_path, ocr_text FROM images WHERE note_id = ?1",
            )?;
            let rows = st.query_map([&note.id], |r| Ok((r.get(0)?, r.get(1)?)))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        note.tags = tags;
        note.imageUrls = images.iter().map(|(p, _)| p.clone()).collect();
        note.ocrText = images.iter().map(|(_, o)| o.clone()).collect::<Vec<_>>().join(" ");
    }
    Ok(notes)
}

/// Full backup export: notes.json + optional media copies.
pub fn export_backup(
    store: &Store,
    out_dir: &Path,
    include_media: bool,
) -> Result<Manifest, StoreError> {
    std::fs::create_dir_all(out_dir).map_err(|e| StoreError(e.to_string()))?;
    let notes = collect_backup_notes(store)?;

    if include_media {
        let media_dir = out_dir.join("media");
        std::fs::create_dir_all(&media_dir).map_err(|e| StoreError(e.to_string()))?;
        for note in &notes {
            for url in &note.imageUrls {
                let src = Path::new(url);
                if src.exists() {
                    let rel = src
                        .file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_else(|| format!("{}.jpg", note.id));
                    let dst = media_dir.join(&rel);
                    let _ = std::fs::copy(src, &dst);
                }
            }
        }
    }

    std::fs::write(
        out_dir.join("notes.json"),
        serde_json::to_string_pretty(&notes).map_err(|e| StoreError(e.to_string()))?,
    )
    .map_err(|e| StoreError(e.to_string()))?;

    let manifest = Manifest {
        format_version: BACKUP_FORMAT_VERSION,
        exported_at_epoch_secs: now_epoch_secs(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        note_count: notes.len(),
        media_included: include_media,
        text_model_id: store.get_setting("text_model_id")?,
        image_model_id: store.get_setting("image_model_id")?,
    };
    std::fs::write(
        out_dir.join("manifest.json"),
        serde_json::to_string_pretty(&manifest).map_err(|e| StoreError(e.to_string()))?,
    )
    .map_err(|e| StoreError(e.to_string()))?;

    let mut checksums: HashMap<String, String> = HashMap::new();
    for entry in std::fs::read_dir(out_dir).map_err(|e| StoreError(e.to_string()))? {
        let entry = entry.map_err(|e| StoreError(e.to_string()))?;
        let path = entry.path();
        if path.is_file() {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            checksums.insert(name, sha256_file(&path));
        }
    }
    std::fs::write(
        out_dir.join("checksums.json"),
        serde_json::to_string_pretty(&checksums).map_err(|e| StoreError(e.to_string()))?,
    )
    .map_err(|e| StoreError(e.to_string()))?;

    Ok(manifest)
}

/// Import notes.json (array form) — idempotent (upsert per note).
pub fn import_notes_json(store: &mut Store, notes_json: &str) -> Result<usize, StoreError> {
    let notes: Vec<BackupNote> =
        serde_json::from_str(notes_json).map_err(|e| StoreError(format!("bad notes.json: {e}")))?;
    let mut count = 0usize;
    for note in notes {
        let tags: Vec<String> = note.tags.clone();
        let images: Vec<NewImage<'_>> = note
            .imageUrls
            .iter()
            .map(|url| NewImage {
                local_path: url,
                source_url: url,
                width: None,
                height: None,
                sha256: "",
            })
            .collect();
        let note_type = if note.mediaStatus == "video" { "video" } else { "normal" };
        let category: String = if note.category.is_empty() {
            "待分类".to_string()
        } else {
            note.category.clone()
        };
        let saved_at: String = if note.savedAt.is_empty() {
            "1970-01-01T00:00:00Z".to_string()
        } else {
            note.savedAt.clone()
        };
        let cover_url: String = note.imageUrls.first().cloned().unwrap_or_default();
        let new_note = NewNote {
            id: &note.id,
            source_url: &note.sourceUrl,
            title: &note.title,
            raw_content: &note.rawContent,
            author_name: &note.author,
            author_id: &note.authorId,
            category: &category,
            note_type,
            cover_url: &cover_url,
            likes: 0,
            collects: 0,
            comments: 0,
            saved_at: &saved_at,
            tags: &tags,
        };
        import_note(store, &new_note, &images, &[], "")?;
        count += 1;
    }
    Ok(count)
}

/// Post-import reindex marker: sets index_status back to pending so the
/// indexing pipeline re-embeds everything.
pub fn schedule_reindex(store: &Store) -> Result<usize, StoreError> {
    let updated = store.conn().execute(
        "UPDATE notes SET index_status = 'pending',
                updated_at = datetime('now')",
        [],
    )?;
    Ok(updated)
}

fn now_epoch_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn sha256_file(path: &Path) -> String {
    let mut hasher = Sha256::new();
    if let Ok(mut f) = std::fs::File::open(path) {
        let mut buf = [0u8; 65536];
        loop {
            match f.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => hasher.update(&buf[..n]),
                Err(_) => break,
            }
        }
    }
    format!("{:x}", hasher.finalize())
}
