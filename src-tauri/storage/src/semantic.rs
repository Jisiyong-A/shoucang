//! Semantic retrieval + hybrid fusion (Tasks 07/09).
//!
//! Channels:
//!   A) Lexical      — FTS5/BM25 (search::fts_search)
//!   B) Text semantic — chunk vectors → note aggregation
//!   C) Image semantic — image vectors
//! Fusion: Reciprocal Rank Fusion (RRF) over channel ranks.

use rusqlite::params;

use super::embed::cosine;
use super::store::{Store, StoreError};

#[derive(Debug, Clone)]
pub struct SemanticHit {
    pub note_id: String,
    pub chunk_id: i64,
    pub score: f32,
    pub text: String,
}

/// Note-level aggregation strategies for multiple chunk hits (Task 07 §7).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Aggregation {
    /// best chunk score only (spike default; simplest, robust)
    Max,
    /// top-2 scores weighted 0.6 / 0.4
    Top2Weighted,
    /// log-sum-exp with temperature 1.0 (smooth max)
    LogSumExp,
}

impl Aggregation {
    pub fn name(self) -> &'static str {
        match self {
            Aggregation::Max => "max",
            Aggregation::Top2Weighted => "top2_weighted",
            Aggregation::LogSumExp => "log_sum_exp",
        }
    }

    pub fn aggregate(&self, scores: &mut [f32]) -> f32 {
        match self {
            Aggregation::Max => scores.iter().copied().fold(f32::MIN, f32::max),
            Aggregation::Top2Weighted => {
                scores.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
                let top2 = scores.iter().take(2).copied().collect::<Vec<_>>();
                match top2.len() {
                    0 => f32::MIN,
                    1 => top2[0],
                    _ => top2[0] * 0.6 + top2[1] * 0.4,
                }
            }
            Aggregation::LogSumExp => {
                if scores.is_empty() {
                    return f32::MIN;
                }
                let max = scores.iter().copied().fold(f32::MIN, f32::max);
                if !max.is_finite() {
                    return f32::MIN;
                }
                let sum: f32 = scores.iter().map(|s| (s - max).exp()).sum();
                max + sum.ln()
            }
        }
    }
}

/// Channel B: rank chunks by cosine against the query vector, group by note.
/// `query_vec` must be L2-normalized (caller responsibility).
pub fn text_semantic_search(
    store: &Store,
    query_vec: &[f32],
    model_id: &str,
    top_chunks: usize,
    agg: Aggregation,
) -> Result<Vec<(String, f32)>, StoreError> {
    // Load chunk embeddings joined with note_id + chunk text.
    let mut stmt = store.conn().prepare(
        "SELECT e.entity_id, c.note_id, c.text, e.dims, e.vector_blob
         FROM text_embeddings e
         JOIN note_chunks c ON c.id = e.entity_id
         WHERE e.entity_type = 'chunk' AND e.model_id = ?1",
    )?;
    let rows = stmt.query_map([model_id], |row| {
        let chunk_id: i64 = row.get(0)?;
        let note_id: String = row.get(1)?;
        let text: String = row.get(2)?;
        let dims: usize = row.get::<_, i64>(3)? as usize;
        let blob: Vec<u8> = row.get(4)?;
        Ok((chunk_id, note_id, text, dims, blob))
    })?;

    let mut per_note: std::collections::HashMap<String, Vec<(f32, i64, String)>> =
        std::collections::HashMap::new();
    for row in rows {
        let (chunk_id, note_id, text, dims, blob) = row?;
        if dims != query_vec.len() {
            continue; // model mismatch guard
        }
        let vec = super::embed::decode_blob(&blob, dims)?;
        let score = cosine(&vec, query_vec);
        per_note
            .entry(note_id)
            .or_default()
            .push((score, chunk_id, text));
    }

    let mut ranked: Vec<(String, f32, i64, String)> = Vec::new();
    for (note_id, mut hits) in per_note {
        hits.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        let mut scores: Vec<f32> = hits.iter().map(|h| h.0).collect();
        let note_score = agg.aggregate(&mut scores);
        let (_, chunk_id, text) = hits.first().cloned().unwrap_or((0.0, 0, String::new()));
        ranked.push((note_id, note_score, chunk_id, text));
    }
    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    ranked.truncate(top_chunks);

    Ok(ranked
        .into_iter()
        .map(|(note_id, score, _, _)| (note_id, score))
        .collect())
}

/// Channel C: rank images by cosine against the visual-query vector.
pub fn image_semantic_search(
    store: &Store,
    query_vec: &[f32],
    model_id: &str,
    top_k: usize,
) -> Result<Vec<(i64, String, f32)>, StoreError> {
    let mut stmt = store.conn().prepare(
        "SELECT im.image_id, i.note_id, im.dims, im.vector_blob
         FROM image_embeddings im
         JOIN images i ON i.id = im.image_id
         WHERE im.model_id = ?1",
    )?;
    let rows = stmt.query_map([model_id], |row| {
        let image_id: i64 = row.get(0)?;
        let note_id: String = row.get(1)?;
        let dims: usize = row.get::<_, i64>(2)? as usize;
        let blob: Vec<u8> = row.get(3)?;
        Ok((image_id, note_id, dims, blob))
    })?;
    let mut scored: Vec<(f32, i64, String)> = Vec::new();
    for row in rows {
        let (image_id, note_id, dims, blob) = row?;
        if dims != query_vec.len() {
            continue;
        }
        let vec = super::embed::decode_blob(&blob, dims)?;
        scored.push((cosine(&vec, query_vec), image_id, note_id));
    }
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);
    Ok(scored
        .into_iter()
        .map(|(score, image_id, note_id)| (image_id, note_id, score))
        .collect())
}

/// Reciprocal Rank Fusion over ranked id lists (k = 60 standard).
pub fn rrf_fuse<T: Clone + std::hash::Hash + Eq>(ranked_lists: &[Vec<T>], k: usize) -> Vec<T> {
    let mut scores: std::collections::HashMap<T, f32> = std::collections::HashMap::new();
    for ranked in ranked_lists {
        for (rank, item) in ranked.iter().enumerate() {
            *scores.entry(item.clone()).or_insert(0.0) += 1.0 / (k as f32 + rank as f32 + 1.0);
        }
    }
    let mut out: Vec<(f32, T)> = scores
        .into_iter()
        .map(|(item, score)| (score, item))
        .collect();
    out.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    out.into_iter().map(|(_, item)| item).collect()
}

/// Load a single chunk embedding by chunk id (used by explainability).
pub fn chunk_embedding(
    store: &Store,
    chunk_id: i64,
    model_id: &str,
) -> Result<Option<Vec<f32>>, StoreError> {
    let result = store.conn().query_row(
        "SELECT dims, vector_blob FROM text_embeddings
         WHERE entity_type = 'chunk' AND entity_id = ?1 AND model_id = ?2",
        params![chunk_id, model_id],
        |row| {
            let dims: usize = row.get::<_, i64>(0)? as usize;
            let blob: Vec<u8> = row.get(1)?;
            Ok((dims, blob))
        },
    );
    match result {
        Ok((dims, blob)) => Ok(Some(super::embed::decode_blob(&blob, dims)?)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(err) => Err(StoreError(err.to_string())),
    }
}

/// Convenience re-export to keep search call sites uniform.
pub use super::search::fts_search;
