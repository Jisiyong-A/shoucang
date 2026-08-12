//! Task 14 §8 scale test: synthetic 100/500/1000 notes × 10 chunks each,
//! measures brute-force text semantic search latency (512-d, bge-like).
//!
//! Run with:  cargo test --release --test scale_test -- --ignored --nocapture

use std::path::PathBuf;
use std::time::Instant;

use kankan_storage::{embed, notes, open, semantic};

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kankan-scale-{name}"));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("store.db");
    let _ = std::fs::remove_file(&path);
    let _ = std::fs::remove_file(format!("{}-wal", path.display()));
    let _ = std::fs::remove_file(format!("{}-shm", path.display()));
    path
}

const DIM: usize = 512;

fn synthetic_vec(seed: u64) -> Vec<f32> {
    // deterministic pseudo-random vector, then L2-normalized
    let mut v: Vec<f32> = (0..DIM)
        .map(|i| ((seed.wrapping_mul(31).wrapping_add(i as u64 * 17) % 1000) as f32 - 500.0) / 500.0)
        .collect();
    embed::l2_normalize(&mut v);
    v
}

fn populate(store: &mut kankan_storage::Store, note_count: usize, chunks_per_note: usize) {
    for n in 0..note_count {
        let id = format!("n{n:05}");
        let title = format!("合成笔记 {n} 标题");
        let content = format!(
            "这是第 {n} 篇合成笔记的正文内容，用于规模测试。{}",
            "包含一些建筑设计与室内设计的描述文字。".repeat(4)
        );
        let chunks: Vec<notes::NewChunk<'_>> = (0..chunks_per_note)
            .map(|c| notes::NewChunk {
                index: c as i64,
                source: notes::ChunkSource::Body,
                text: &content,
                start: 0,
                end: content.len() as i64,
            })
            .collect();
        notes::import_note(
            store,
            &notes::NewNote {
                id: &id,
                source_url: &format!("https://xhs.test/{id}"),
                title: &title,
                raw_content: &content,
                author_name: "规模测试作者",
                author_id: "u-scale",
                category: "建筑",
                note_type: "normal",
                cover_url: "",
                likes: 0,
                collects: 0,
                comments: 0,
                saved_at: "2026-08-12T00:00:00Z",
                tags: &[],
            },
            &[],
            &chunks,
            "",
        )
        .unwrap();
        // embeddings for all chunks of this note
        let chunk_ids: Vec<i64> = store
            .conn()
            .prepare("SELECT id FROM note_chunks WHERE note_id = ?1 ORDER BY chunk_index")
            .unwrap()
            .query_map([&id], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for (i, cid) in chunk_ids.iter().enumerate() {
            let vec = synthetic_vec(n as u64 * 100 + i as u64);
            embed::upsert_text_embedding(store, "chunk", *cid, "bge-scale", &vec, true).unwrap();
        }
    }
}

fn bench_scale(note_count: usize) {
    let mut store = open(&temp_db(&format!("{note_count}"))).unwrap();
    let t0 = Instant::now();
    populate(&mut store, note_count, 10);
    let index_secs = t0.elapsed().as_secs_f32();

    // warmup query
    let q = synthetic_vec(42);
    semantic::text_semantic_search(&store, &q, "bge-scale", 10, semantic::Aggregation::Max).unwrap();

    // 10 queries, take median of the middle 8
    let mut lats = Vec::new();
    for s in 0..10 {
        let q = synthetic_vec(1000 + s);
        let t = Instant::now();
        let res = semantic::text_semantic_search(&store, &q, "bge-scale", 10, semantic::Aggregation::Max)
            .unwrap();
        lats.push((t.elapsed().as_millis() as f64, res.len()));
    }
    lats.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    let median = lats[5].0;
    let chunks: i64 = store
        .conn()
        .query_row("SELECT COUNT(*) FROM note_chunks", [], |r| r.get(0))
        .unwrap();
    let db_size = std::fs::metadata(temp_db(&format!("{note_count}")))
        .map(|m| m.len() as f64 / 1048576.0)
        .unwrap_or(0.0);
    println!(
        "scale notes={note_count} chunks={chunks} index_secs={index_secs:.1} median_query_ms={median:.1} db_mb={db_size:.1}"
    );
}

#[test]
#[ignore = "scale benchmark; run explicitly with --ignored --release"]
fn scale_100() {
    bench_scale(100);
}

#[test]
#[ignore = "scale benchmark; run explicitly with --ignored --release"]
fn scale_500() {
    bench_scale(500);
}

#[test]
#[ignore = "scale benchmark; run explicitly with --ignored --release"]
fn scale_1000() {
    bench_scale(1000);
}
