//! Ingest job state machine (Task 10).
//!
//! Main flow:
//!   RECEIVED → RESOLVING → DOWNLOADING_MEDIA → OCR → CHUNKING →
//!   TEXT_EMBEDDING → IMAGE_EMBEDDING → FTS_INDEX → READY
//! Error/terminal states:
//!   PENDING_NETWORK (retryable) · PARTIAL · FAILED · CANCELLED

use rusqlite::{params, OptionalExtension};

use super::store::{Store, StoreError};

/// All legal states (used for validation and UI display).
pub const STATES: &[&str] = &[
    // main flow
    "RECEIVED",
    "RESOLVING",
    "DOWNLOADING_MEDIA",
    "OCR",
    "CHUNKING",
    "TEXT_EMBEDDING",
    "IMAGE_EMBEDDING",
    "FTS_INDEX",
    "READY",
    // error / terminal
    "PENDING_NETWORK",
    "PARTIAL",
    "FAILED",
    "CANCELLED",
];

/// States considered terminal (never resumed).
pub fn is_terminal(state: &str) -> bool {
    matches!(state, "READY" | "FAILED" | "CANCELLED" | "PARTIAL")
}

#[derive(Debug, Clone)]
pub struct IngestJob {
    pub id: i64,
    pub note_id: String,
    pub state: String,
    pub raw_share: String,
    pub error: String,
    pub progress: i64,
    pub attempts: i64,
    pub created_at: String,
    pub updated_at: String,
}

fn job_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<IngestJob> {
    Ok(IngestJob {
        id: row.get(0)?,
        note_id: row.get(1)?,
        state: row.get(2)?,
        raw_share: row.get(3)?,
        error: row.get(4)?,
        progress: row.get(5)?,
        attempts: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

pub fn transition(
    store: &Store,
    job_id: i64,
    state: &str,
    progress: i64,
    error: &str,
) -> Result<(), StoreError> {
    debug_assert!(
        STATES.contains(&state),
        "unknown ingest state: {state}"
    );
    store.conn().execute(
        "UPDATE ingest_jobs SET state = ?2, progress = ?3, error = ?4,
                updated_at = datetime('now')
         WHERE id = ?1",
        params![job_id, state, progress, error],
    )?;
    Ok(())
}

/// Retry bookkeeping — bump attempts, move to PENDING_NETWORK on transient failure.
pub fn mark_retryable(store: &Store, job_id: i64, error: &str) -> Result<(), StoreError> {
    store.conn().execute(
        "UPDATE ingest_jobs SET state = 'PENDING_NETWORK', error = ?2,
                attempts = attempts + 1, updated_at = datetime('now')
         WHERE id = ?1",
        params![job_id, error],
    )?;
    Ok(())
}

pub fn fail(store: &Store, job_id: i64, error: &str) -> Result<(), StoreError> {
    store.conn().execute(
        "UPDATE ingest_jobs SET state = 'FAILED', error = ?2,
                attempts = attempts + 1, updated_at = datetime('now')
         WHERE id = ?1",
        params![job_id, error],
    )?;
    Ok(())
}

/// User cancelled (e.g. note deleted mid-ingest).
pub fn cancel(store: &Store, job_id: i64) -> Result<(), StoreError> {
    store.conn().execute(
        "UPDATE ingest_jobs SET state = 'CANCELLED', updated_at = datetime('now')
         WHERE id = ?1",
        [job_id],
    )?;
    Ok(())
}

/// Partial completion (e.g. some media failed but note is usable).
pub fn mark_partial(store: &Store, job_id: i64, error: &str) -> Result<(), StoreError> {
    store.conn().execute(
        "UPDATE ingest_jobs SET state = 'PARTIAL', error = ?2,
                updated_at = datetime('now')
         WHERE id = ?1",
        params![job_id, error],
    )?;
    Ok(())
}

pub fn get_job(store: &Store, job_id: i64) -> Result<Option<IngestJob>, StoreError> {
    Ok(store
        .conn()
        .query_row(
            "SELECT id, note_id, state, raw_share, error, progress, attempts,
                    created_at, updated_at
             FROM ingest_jobs WHERE id = ?1",
            [job_id],
            job_row,
        )
        .optional()?)
}

/// Recover interrupted ingests: everything that is not terminal and not
/// currently running returns to a retryable state.
pub fn recover_interrupted(
    store: &mut Store,
    running_job_ids: &[i64],
) -> Result<usize, StoreError> {
    let mut count = 0usize;
    let conn = store.conn_mut();
    let tx = conn.unchecked_transaction()?;
    {
        let mut stmt = tx.prepare(
            "SELECT id FROM ingest_jobs
             WHERE state NOT IN ('READY','FAILED','CANCELLED','PARTIAL')",
        )?;
        let ids = stmt.query_map([], |row| row.get::<_, i64>(0))?;
        // Consume the iterator fully BEFORE writing, or the cursor gets
        // disturbed by the UPDATEs below (rusqlite/SQLite quirk).
        let ids: Vec<i64> = ids.collect::<Result<Vec<_>, _>>()?;
        for id in ids {
            if running_job_ids.contains(&id) {
                continue;
            }
            tx.execute(
                "UPDATE ingest_jobs SET state = 'RECEIVED', error = 'interrupted',
                        updated_at = datetime('now')
                 WHERE id = ?1",
                [id],
            )?;
            count += 1;
        }
    }
    tx.commit()?;
    Ok(count)
}
