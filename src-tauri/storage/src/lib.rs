//! kankan-storage — SQLite knowledge store for 看看收藏 (Task 05).
//!
//! Pure Rust (rusqlite, bundled SQLite with FTS5) — no tauri dependency, so
//! it can be unit-tested standalone and reused verbatim on Android arm64.
//!
//! Design notes:
//! - `PRAGMA user_version` migrations, WAL journal, FK enforcement
//! - notes/images/note_chunks/ocr_blocks/tags + FTS5 (BM25)
//! - embeddings as raw f32 BLOBs + Rust brute-force cosine (1k–10k chunks)
//! - ingest_jobs state machine so an interrupted ingest is recoverable

pub mod backup;
pub mod chunk;
pub mod embed;
pub mod ingest;
pub mod notes;
pub mod schema;
pub mod search;
pub mod semantic;
pub mod store;

pub use schema::{MigrateError, SCHEMA_VERSION};
pub use store::{Store, StoreError};

/// Open (or create) the knowledge store at `path`, run migrations, enable WAL.
pub fn open(path: &std::path::Path) -> Result<Store, StoreError> {
    let store = Store::open(path)?;
    store.migrate().map_err(|e| StoreError(e.0))?;
    Ok(store)
}
