//! Note / image / chunk / tag persistence + atomic import.
//!
//! `import_note` writes the note, its images, chunks, tags and the initial
//! ingest job inside ONE transaction — the app can be killed mid-import and
//! the DB still has a consistent, recoverable state (ingest_jobs.state).

use rusqlite::{params, OptionalExtension, Row, Transaction};

use super::store::{Store, StoreError};

#[derive(Debug, Clone)]
pub struct NewNote<'a> {
    pub id: &'a str,
    pub source_url: &'a str,
    pub title: &'a str,
    pub raw_content: &'a str,
    pub author_name: &'a str,
    pub author_id: &'a str,
    pub category: &'a str,
    pub note_type: &'a str,
    pub cover_url: &'a str,
    pub likes: i64,
    pub collects: i64,
    pub comments: i64,
    pub saved_at: &'a str,
    pub tags: &'a [String],
}

#[derive(Debug, Clone)]
pub struct NewImage<'a> {
    pub local_path: &'a str,
    pub source_url: &'a str,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub sha256: &'a str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChunkSource {
    Title,
    Body,
    Ocr,
    Tags,
    Metadata,
}

impl ChunkSource {
    pub fn as_str(self) -> &'static str {
        match self {
            ChunkSource::Title => "title",
            ChunkSource::Body => "body",
            ChunkSource::Ocr => "ocr",
            ChunkSource::Tags => "tags",
            ChunkSource::Metadata => "metadata",
        }
    }
}

#[derive(Debug, Clone)]
pub struct NewChunk<'a> {
    pub index: i64,
    pub source: ChunkSource,
    pub text: &'a str,
    pub start: i64,
    pub end: i64,
}

/// Atomic import: note + images + chunks + tags + ingest job in one tx.
pub fn import_note(
    store: &mut Store,
    note: &NewNote<'_>,
    images: &[NewImage<'_>],
    chunks: &[NewChunk<'_>],
    raw_share: &str,
) -> Result<i64, StoreError> {
    let conn = store.conn_mut();
    let tx = conn.unchecked_transaction()?;
    let now = &note.saved_at;

    tx.execute(
        "INSERT INTO notes(
             id, source_url, title, raw_content, author_name, author_id,
             category, type, cover_url, likes, collects, comments,
             media_status, index_status, saved_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'pending','pending',?13,?13)
         ON CONFLICT(id) DO UPDATE SET
             source_url=excluded.source_url, title=excluded.title,
             raw_content=excluded.raw_content, author_name=excluded.author_name,
             category=excluded.category, cover_url=excluded.cover_url,
             updated_at=excluded.updated_at",
        params![
            note.id,
            note.source_url,
            note.title,
            note.raw_content,
            note.author_name,
            note.author_id,
            note.category,
            note.note_type,
            note.cover_url,
            note.likes,
            note.collects,
            note.comments,
            now,
        ],
    )?;

    tx.execute("DELETE FROM images WHERE note_id = ?1", [note.id])?;
    for image in images {
        tx.execute(
            "INSERT INTO images(note_id, local_path, source_url, width, height, sha256)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                note.id,
                image.local_path,
                image.source_url,
                image.width,
                image.height,
                image.sha256,
            ],
        )?;
    }

    tx.execute("DELETE FROM note_chunks WHERE note_id = ?1", [note.id])?;
    for chunk in chunks {
        tx.execute(
            "INSERT INTO note_chunks(note_id, chunk_index, source_type, text, start_offset, end_offset)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                note.id,
                chunk.index,
                chunk.source.as_str(),
                chunk.text,
                chunk.start,
                chunk.end,
            ],
        )?;
    }

    replace_tags(&tx, note.id, note.tags)?;
    refresh_note_fts(&tx, note.id)?;

    let job_id = tx.query_row(
        "INSERT INTO ingest_jobs(note_id, state, raw_share, created_at, updated_at)
         VALUES (?1,'RECEIVED',?2,?3,?3)
         RETURNING id",
        params![note.id, raw_share, now],
        |row| row.get::<_, i64>(0),
    )?;

    tx.commit()?;
    Ok(job_id)
}

fn replace_tags(tx: &Transaction<'_>, note_id: &str, tags: &[String]) -> Result<(), StoreError> {
    tx.execute("DELETE FROM note_tags WHERE note_id = ?1", [note_id])?;
    for tag in tags {
        let tag = tag.trim();
        if tag.is_empty() {
            continue;
        }
        tx.execute(
            "INSERT INTO tags(name) VALUES (?1) ON CONFLICT(name) DO NOTHING",
            [tag],
        )?;
        let tag_id: i64 = tx.query_row(
            "SELECT id FROM tags WHERE name = ?1",
            [tag],
            |row| row.get(0),
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO note_tags(note_id, tag_id) VALUES (?1, ?2)",
            params![note_id, tag_id],
        )?;
    }
    Ok(())
}

/// Chinese-aware FTS preprocessing: split runs of CJK characters into
/// 2-grams joined by spaces. FTS5's unicode61 tokenizer treats a whole CJK
/// run as ONE token, which makes substring queries (「金泽」) impossible.
/// Bigramming both the index side and the query side fixes that.
pub fn cjk_bigrams(text: &str) -> String {
    let mut out = String::with_capacity(text.len() * 2);
    let mut run: Vec<char> = Vec::new();
    for ch in text.chars() {
        if ('\u{4e00}'..='\u{9fff}').contains(&ch)
            || ('\u{3400}'..='\u{4dbf}').contains(&ch)
            || ('\u{f900}'..='\u{faff}').contains(&ch)
        {
            run.push(ch);
            continue;
        }
        flush_bigrams(&mut run, &mut out);
        out.push(ch);
    }
    flush_bigrams(&mut run, &mut out);
    out
}

fn flush_bigrams(run: &mut Vec<char>, out: &mut String) {
    if run.len() >= 2 {
        for pair in run.windows(2) {
            out.push(pair[0]);
            out.push(pair[1]);
            out.push(' ');
        }
    } else if let Some(ch) = run.first() {
        out.push(*ch);
        out.push(' ');
    }
    run.clear();
}

/// Rebuild the FTS row for one note from its aggregated fields.
/// Must be called AFTER all child rows (chunks/images/tags) are written.
fn refresh_note_fts(tx: &Transaction<'_>, note_id: &str) -> Result<(), StoreError> {
    let (title, raw, author, category): (String, String, String, String) = tx.query_row(
        "SELECT title, raw_content, author_name, category FROM notes WHERE id = ?1",
        [note_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    )?;
    let body: String = tx.query_row(
        "SELECT COALESCE(group_concat(text, ' '), '') FROM note_chunks WHERE note_id = ?1",
        [note_id],
        |row| row.get(0),
    )?;
    let ocr: String = tx.query_row(
        "SELECT COALESCE(group_concat(ocr_text, ' '), '') FROM images
         WHERE note_id = ?1 AND ocr_text != ''",
        [note_id],
        |row| row.get(0),
    )?;
    let tags: String = tx.query_row(
        "SELECT COALESCE(group_concat(t.name, ' '), '') FROM note_tags nt
         JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id = ?1",
        [note_id],
        |row| row.get(0),
    )?;
    let rowid: i64 = tx.query_row(
        "SELECT rowid FROM notes WHERE id = ?1",
        [note_id],
        |row| row.get(0),
    )?;

    tx.execute("DELETE FROM notes_fts WHERE rowid = ?1", [rowid])?;
    tx.execute(
        "INSERT INTO notes_fts(rowid, note_id, title, body, ocr, tags, author, category)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            rowid,
            note_id,
            cjk_bigrams(&title),
            cjk_bigrams(&format!("{raw} {body}")),
            cjk_bigrams(&ocr),
            cjk_bigrams(&tags),
            cjk_bigrams(&author),
            category,
        ],
    )?;
    Ok(())
}

/// Drop the FTS row for a note (before deleting the note itself).
pub fn delete_note_fts(store: &mut Store, note_id: &str) -> Result<(), StoreError> {
    let conn = store.conn_mut();
    let tx = conn.unchecked_transaction()?;
    delete_note_fts_in(&tx, note_id)
}

// ---------- queries ----------

pub struct NoteRow {
    pub id: String,
    pub title: String,
    pub category: String,
    pub media_status: String,
    pub index_status: String,
    pub saved_at: String,
}

fn note_row(row: &Row<'_>) -> rusqlite::Result<NoteRow> {
    Ok(NoteRow {
        id: row.get(0)?,
        title: row.get(1)?,
        category: row.get(2)?,
        media_status: row.get(3)?,
        index_status: row.get(4)?,
        saved_at: row.get(5)?,
    })
}

pub fn list_notes(store: &Store, limit: i64) -> Result<Vec<NoteRow>, StoreError> {
    let mut stmt = store
        .conn()
        .prepare("SELECT id, title, category, media_status, index_status, saved_at
                  FROM notes ORDER BY saved_at DESC LIMIT ?1")?;
    let rows = stmt.query_map([limit], note_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn get_note(store: &Store, note_id: &str) -> Result<Option<NoteRow>, StoreError> {
    Ok(store
        .conn()
        .query_row(
            "SELECT id, title, category, media_status, index_status, saved_at
             FROM notes WHERE id = ?1",
            [note_id],
            note_row,
        )
        .optional()?)
}

pub fn delete_note(store: &mut Store, note_id: &str) -> Result<(), StoreError> {
    let conn = store.conn_mut();
    let tx = conn.unchecked_transaction()?;
    delete_note_fts_in(&tx, note_id)?;
    // polymorphic text_embeddings have no FK — clean explicitly (note/chunk/ocr)
    tx.execute(
        "DELETE FROM text_embeddings WHERE
             (entity_type = 'note' AND entity_id = (SELECT rowid FROM notes WHERE id = ?1))
          OR (entity_type = 'chunk' AND entity_id IN
                 (SELECT id FROM note_chunks WHERE note_id = ?1))
          OR (entity_type = 'ocr' AND entity_id IN
                 (SELECT id FROM ocr_blocks WHERE image_id IN
                     (SELECT id FROM images WHERE note_id = ?1)))",
        [note_id],
    )?;
    tx.execute("DELETE FROM notes WHERE id = ?1", [note_id])?;
    tx.commit()?;
    Ok(())
}

fn delete_note_fts_in(tx: &Transaction<'_>, note_id: &str) -> Result<(), StoreError> {
    tx.execute(
        "DELETE FROM notes_fts WHERE rowid IN (SELECT rowid FROM notes WHERE id = ?1)",
        [note_id],
    )?;
    Ok(())
}

pub fn set_index_status(store: &Store, note_id: &str, status: &str) -> Result<(), StoreError> {
    store.conn().execute(
        "UPDATE notes SET index_status = ?2, updated_at = datetime('now') WHERE id = ?1",
        params![note_id, status],
    )?;
    Ok(())
}

/// Insert OCR text for an image (also feeds FTS via re-chunk later).
pub fn set_image_ocr(
    store: &Store,
    image_local_path: &str,
    ocr_text: &str,
    status: &str,
) -> Result<Option<i64>, StoreError> {
    let updated = store.conn().execute(
        "UPDATE images SET ocr_text = ?2, ocr_status = ?3 WHERE local_path = ?1",
        params![image_local_path, ocr_text, status],
    )?;
    if updated == 0 {
        return Ok(None);
    }
    Ok(store
        .conn()
        .query_row(
            "SELECT id FROM images WHERE local_path = ?1",
            [image_local_path],
            |row| row.get(0),
        )
        .optional()?)
}
