//! Lexical (FTS5/BM25) + vector search with field weighting.
//!
//! FTS query uses the MATCH grammar; `title > tags > body > OCR > author`
//! weights are applied as score multipliers (BM25 per column).

use rusqlite::{params, Row};

use super::store::{Store, StoreError};

/// BM25 penalty weights per FTS column. FTS5 `bm25()` treats weights as
/// penalties — SMALLER = more important. So title < tags < body < ocr < author
/// matches the "title > tags > body > OCR > author" priority. Tuned by
/// benchmark in Task 09.
pub const FIELD_WEIGHTS: &[(&str, f64)] = &[
    ("title", 0.2),
    ("tags", 0.8),
    ("body", 1.0),
    ("ocr", 1.2),
    ("author", 1.5),
    ("category", 1.5),
];

#[derive(Debug, Clone)]
pub struct SearchHit {
    pub note_id: String,
    pub title: String,
    pub score: f64,
    pub snippet: String,
}

fn hit_row(row: &Row<'_>) -> rusqlite::Result<SearchHit> {
    Ok(SearchHit {
        note_id: row.get(0)?,
        title: row.get(1)?,
        score: row.get(2)?,
        snippet: row.get(3).unwrap_or_default(),
    })
}

/// FTS5 keyword search (BM25), ordered by weighted score.
pub fn fts_search(
    store: &Store,
    query: &str,
    limit: i64,
) -> Result<Vec<SearchHit>, StoreError> {
    let terms = query
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .collect::<Vec<_>>();
    if terms.is_empty() {
        return Ok(Vec::new());
    }
    // Chinese-aware: bigram the whole query the same way the index is built,
    // so CJK substring queries (「金泽」) match. Non-CJK terms pass through.
    let bigrammed = super::notes::cjk_bigrams(query);
    let matcher = bigrammed
        .split_whitespace()
        .map(|t| format!("\"{}\"", t.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" OR ");

    // bm25() weights are positional over ALL fts columns (incl. UNINDEXED).
    // Column order: note_id(0) title(1) body(2) ocr(3) tags(4) author(5) category(6)
    let weight_for = |name: &str| -> f64 {
        FIELD_WEIGHTS
            .iter()
            .find(|(n, _)| *n == name)
            .map(|(_, w)| *w)
            .unwrap_or(1.0)
    };
    let weights = [
        0.0,                       // note_id (unindexed)
        weight_for("title"),
        weight_for("body"),
        weight_for("ocr"),
        weight_for("tags"),
        weight_for("author"),
        weight_for("category"),
    ]
    .iter()
    .map(|w| format!("{w}"))
    .collect::<Vec<_>>()
    .join(",");

    let sql = format!(
        "SELECT f.note_id, n.title,
                bm25(notes_fts, {weights}) AS score,
                snippet(notes_fts, 2, '…', '…', '…', 24) AS snip
         FROM notes_fts f JOIN notes n ON n.id = f.note_id
         WHERE notes_fts MATCH ?1
         ORDER BY score ASC
         LIMIT ?2"
    );
    let mut stmt = store.conn().prepare(&sql)?;
    let rows = stmt.query_map(params![matcher, limit], hit_row)?;
    let mut hits = Vec::new();
    for row in rows {
        hits.push(row?);
    }
    Ok(hits)
}

/// Count notes with a given index status (diagnostics).
pub fn count_notes(store: &Store) -> Result<i64, StoreError> {
    Ok(store
        .conn()
        .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))?)
}
