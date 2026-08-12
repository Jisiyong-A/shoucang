//! Vector BLOB encoding + brute-force similarity (cosine on L2-normalized).

use super::store::{Store, StoreError};

/// Encode a `[f32]` as a raw little-endian BLOB (no header — dims live in
/// the row so blobs stay small).
pub fn encode_blob(vec: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(vec.len() * 4);
    for v in vec {
        out.extend_from_slice(&v.to_le_bytes());
    }
    out
}

/// Decode a vector BLOB; validates length against `dims`.
pub fn decode_blob(blob: &[u8], dims: usize) -> Result<Vec<f32>, StoreError> {
    if blob.len() != dims * 4 {
        return Err(StoreError(format!(
            "vector blob length {} does not match dims {dims}",
            blob.len()
        )));
    }
    let mut out = Vec::with_capacity(dims);
    for chunk in blob.chunks_exact(4) {
        out.push(f32::from_le_bytes(chunk.try_into().unwrap()));
    }
    Ok(out)
}

pub fn l2_normalize(vec: &mut [f32]) {
    let norm = vec.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in vec.iter_mut() {
            *v /= norm;
        }
    }
}

/// Cosine similarity for pre-normalized vectors (dot product).
pub fn cosine(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

/// Brute-force top-k over a candidate list.
/// `score_fn` maps each row to its vector (loaded lazily per candidate).
pub fn top_k<T, F>(items: Vec<T>, k: usize, mut score_fn: F) -> Vec<(f32, T)>
where
    F: FnMut(&T) -> f32,
{
    let mut scored: Vec<(f32, T)> = items
        .into_iter()
        .map(|item| {
            let score = score_fn(&item);
            (score, item)
        })
        .collect();
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(k);
    scored
}

// ---------- persistence helpers ----------

pub fn upsert_text_embedding(
    store: &Store,
    entity_type: &str,
    entity_id: i64,
    model_id: &str,
    vec: &[f32],
    normalized: bool,
) -> Result<(), StoreError> {
    store.conn().execute(
        "INSERT INTO text_embeddings(entity_type, entity_id, model_id, dims, normalized, vector_blob)
         VALUES (?1,?2,?3,?4,?5,?6)
         ON CONFLICT(entity_type, entity_id, model_id) DO UPDATE SET
             dims=excluded.dims, normalized=excluded.normalized, vector_blob=excluded.vector_blob",
        rusqlite::params![entity_type, entity_id, model_id, vec.len() as i64, normalized as i64, encode_blob(vec)],
    )?;
    Ok(())
}

pub fn upsert_image_embedding(
    store: &Store,
    image_id: i64,
    model_id: &str,
    vec: &[f32],
    normalized: bool,
) -> Result<(), StoreError> {
    store.conn().execute(
        "INSERT INTO image_embeddings(image_id, model_id, dims, normalized, vector_blob)
         VALUES (?1,?2,?3,?4,?5)
         ON CONFLICT(image_id) DO UPDATE SET
             model_id=excluded.model_id, dims=excluded.dims,
             normalized=excluded.normalized, vector_blob=excluded.vector_blob",
        rusqlite::params![image_id, model_id, vec.len() as i64, normalized as i64, encode_blob(vec)],
    )?;
    Ok(())
}

pub fn load_text_embedding(
    store: &Store,
    entity_type: &str,
    entity_id: i64,
) -> Result<Option<(String, usize, Vec<f32>)>, StoreError> {
    let result = store.conn().query_row(
        "SELECT model_id, dims, vector_blob FROM text_embeddings
         WHERE entity_type = ?1 AND entity_id = ?2",
        rusqlite::params![entity_type, entity_id],
        |row| {
            let model: String = row.get(0)?;
            let dims: usize = row.get::<_, i64>(1)? as usize;
            let blob: Vec<u8> = row.get(2)?;
            Ok((model, dims, blob))
        },
    );
    match result {
        Ok((model, dims, blob)) => Ok(Some((model, dims, decode_blob(&blob, dims)?))),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(err) => Err(StoreError(err.to_string())),
    }
}

/// Load every text embedding for a model (brute-force scan candidates).
pub fn all_text_embeddings(
    store: &Store,
    model_id: &str,
) -> Result<Vec<(String, i64, usize, Vec<f32>)>, StoreError> {
    let mut stmt = store.conn().prepare(
        "SELECT entity_type, entity_id, dims, vector_blob FROM text_embeddings
         WHERE model_id = ?1",
    )?;
    let rows = stmt.query_map([model_id], |row| {
        let entity_type: String = row.get(0)?;
        let entity_id: i64 = row.get(1)?;
        let dims: usize = row.get::<_, i64>(2)? as usize;
        let blob: Vec<u8> = row.get(3)?;
        Ok((entity_type, entity_id, dims, blob))
    })?;
    let mut out = Vec::new();
    for row in rows {
        let (entity_type, entity_id, dims, blob) = row?;
        out.push((entity_type, entity_id, dims, decode_blob(&blob, dims)?));
    }
    Ok(out)
}
