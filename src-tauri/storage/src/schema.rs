//! Schema definition + versioned migrations (PRAGMA user_version).

pub const SCHEMA_VERSION: i64 = 1;

#[derive(Debug)]
pub struct MigrateError(pub String);

impl std::fmt::Display for MigrateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "migration failed: {}", self.0)
    }
}

impl std::error::Error for MigrateError {}

/// Every migration is a plain SQL batch, applied inside one transaction.
/// `user_version` records the last applied version; never edit old batches.
const MIGRATIONS: &[&str] = &[
    // v1 — initial schema
    r#"
    CREATE TABLE notes (
        id            TEXT PRIMARY KEY,          -- canonical note id (24-hex xhs id)
        source_url    TEXT NOT NULL,
        title         TEXT NOT NULL DEFAULT '',
        raw_content   TEXT NOT NULL DEFAULT '',
        author_name   TEXT NOT NULL DEFAULT '',
        author_id     TEXT NOT NULL DEFAULT '',
        category      TEXT NOT NULL DEFAULT '待分类',
        type          TEXT NOT NULL DEFAULT 'normal',
        cover_url     TEXT NOT NULL DEFAULT '',
        likes         INTEGER NOT NULL DEFAULT 0,
        collects      INTEGER NOT NULL DEFAULT 0,
        comments      INTEGER NOT NULL DEFAULT 0,
        media_status  TEXT NOT NULL DEFAULT 'none',   -- none|pending|ready|partial|failed
        index_status  TEXT NOT NULL DEFAULT 'pending',-- pending|chunked|embedded|indexed|failed
        saved_at      TEXT NOT NULL,
        updated_at    TEXT NOT NULL
    );

    CREATE TABLE images (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id         TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        local_path      TEXT NOT NULL,
        source_url      TEXT NOT NULL DEFAULT '',
        width           INTEGER,
        height          INTEGER,
        ocr_text        TEXT NOT NULL DEFAULT '',
        ocr_status      TEXT NOT NULL DEFAULT 'pending', -- pending|done|failed
        embedding_status TEXT NOT NULL DEFAULT 'pending',
        sha256          TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX idx_images_note ON images(note_id);

    CREATE TABLE note_chunks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        source_type TEXT NOT NULL,   -- title|body|ocr|tags|metadata
        text        TEXT NOT NULL,
        start_offset INTEGER NOT NULL DEFAULT 0,
        end_offset  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_chunks_note ON note_chunks(note_id, chunk_index);

    CREATE TABLE ocr_blocks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id    INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        text        TEXT NOT NULL,
        confidence  REAL NOT NULL DEFAULT 0,
        box_x1      REAL NOT NULL DEFAULT 0,
        box_y1      REAL NOT NULL DEFAULT 0,
        box_x2      REAL NOT NULL DEFAULT 0,
        box_y2      REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_ocr_image ON ocr_blocks(image_id);

    CREATE TABLE text_embeddings (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,        -- note|chunk|ocr
        entity_id   INTEGER NOT NULL,     -- note_chunks.id / ocr_blocks.id / note.id
        model_id    TEXT NOT NULL,
        dims        INTEGER NOT NULL,
        normalized  INTEGER NOT NULL DEFAULT 1,
        vector_blob BLOB NOT NULL
    );
    CREATE UNIQUE INDEX idx_text_emb_uniq ON text_embeddings(entity_type, entity_id, model_id);
    CREATE INDEX idx_text_emb_model ON text_embeddings(model_id);

    CREATE TABLE image_embeddings (
        image_id    INTEGER PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
        model_id    TEXT NOT NULL,
        dims        INTEGER NOT NULL,
        normalized  INTEGER NOT NULL DEFAULT 1,
        vector_blob BLOB NOT NULL
    );

    CREATE TABLE tags (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE note_tags (
        note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (note_id, tag_id)
    );

    CREATE TABLE ingest_jobs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        state       TEXT NOT NULL,   -- RECEIVED|RESOLVING|MEDIA|OCR|TEXT_EMBEDDING|IMAGE_EMBEDDING|INDEXED|FAILED|PENDING_NETWORK
        raw_share   TEXT NOT NULL DEFAULT '',
        error       TEXT NOT NULL DEFAULT '',
        progress    INTEGER NOT NULL DEFAULT 0,
        attempts    INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );
    CREATE INDEX idx_jobs_state ON ingest_jobs(state);

    CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE model_registry (
        model_id        TEXT PRIMARY KEY,
        kind            TEXT NOT NULL,   -- text|image_text|ocr
        version         TEXT NOT NULL,
        license         TEXT NOT NULL,
        local_path      TEXT NOT NULL DEFAULT '',
        sha256          TEXT NOT NULL DEFAULT '',
        installed_state TEXT NOT NULL DEFAULT 'not_installed', -- not_installed|installing|installed|failed
        installed_at    TEXT NOT NULL DEFAULT ''
    );

    -- FTS5 lexical index over searchable fields (BM25).
    CREATE VIRTUAL TABLE notes_fts USING fts5(
        note_id UNINDEXED,
        title,
        body,        -- raw_content + body chunks
        ocr,         -- concatenated ocr_text
        tags,
        author,
        category,
        tokenize = 'unicode61 remove_diacritics 2'
    );
    "#,
];

/// Apply all pending migrations inside a transaction and bump user_version.
pub fn migrate(conn: &rusqlite::Connection) -> Result<(), MigrateError> {
    let current: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| MigrateError(e.to_string()))?;

    if current > SCHEMA_VERSION {
        return Err(MigrateError(format!(
            "db schema v{current} is newer than app supports (v{SCHEMA_VERSION})"
        )));
    }

    for (index, sql) in MIGRATIONS.iter().enumerate() {
        let version = (index + 1) as i64;
        if version <= current {
            continue;
        }
        let tx = conn
            .unchecked_transaction()
            .map_err(|e| MigrateError(e.to_string()))?;
        tx.execute_batch(sql)
            .map_err(|e| MigrateError(format!("v{version}: {e}")))?;
        tx.pragma_update(None, "user_version", version)
            .map_err(|e| MigrateError(format!("v{version} version bump: {e}")))?;
        tx.commit()
            .map_err(|e| MigrateError(format!("v{version} commit: {e}")))?;
    }
    Ok(())
}
