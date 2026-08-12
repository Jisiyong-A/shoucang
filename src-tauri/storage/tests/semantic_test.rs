//! Task 07/09/10 extension tests: chunking, note aggregation, semantic
//! search channels, RRF fusion, full ingest state machine + cancellation.

use std::path::PathBuf;

use kankan_storage::{chunk, embed, ingest, notes, open, search, semantic};

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kankan-storage-test-{name}"));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("store.db");
    let _ = std::fs::remove_file(&path);
    let _ = std::fs::remove_file(format!("{}-wal", path.display()));
    let _ = std::fs::remove_file(format!("{}-shm", path.display()));
    path
}

fn note<'a>(id: &'a str, source_url: &'a str, title: &'a str, content: &'a str, tags: &'a [String]) -> notes::NewNote<'a> {
    notes::NewNote {
        id,
        source_url,
        title,
        raw_content: content,
        author_name: "作者",
        author_id: "u1",
        category: "建筑",
        note_type: "normal",
        cover_url: "",
        likes: 0,
        collects: 0,
        comments: 0,
        saved_at: "2026-08-12T00:00:00Z",
        tags,
    }
}

/// Insert a note and one chunk, then embed the chunk with a hand-built vector.
fn import_with_chunk_embedding(
    store: &mut kankan_storage::Store,
    id: &str,
    title: &str,
    content: &str,
    model: &str,
    vec: &[f32],
) -> i64 {
    notes::import_note(
        store,
        &note(id, &format!("https://xhs.test/{id}"), title, content, &[]),
        &[],
        &[notes::NewChunk {
            index: 0,
            source: notes::ChunkSource::Body,
            text: content,
            start: 0,
            end: content.len() as i64,
        }],
        "",
    )
    .unwrap();
    let chunk_id: i64 = store
        .conn()
        .query_row(
            "SELECT id FROM note_chunks WHERE note_id = ?1",
            [id],
            |r| r.get(0),
        )
        .unwrap();
    embed::upsert_text_embedding(store, "chunk", chunk_id, model, vec, true).unwrap();
    chunk_id
}

// ---------- chunking (Task 07 §1) ----------

#[test]
fn chunker_splits_long_body() {
    let text: String = (0..15)
        .map(|i| format!("第{i}句。{}", "这是一段较长的中文句子，用于测试分块逻辑是否按照句子边界正确切分。"))
        .collect::<Vec<_>>()
        .concat();
    let chunks = chunk::chunk_note_body(&text);
    assert!(chunks.len() >= 2);
    assert!(chunks.iter().all(|c| c.chars().count() <= 450));
    // overlap: reconstructed length must exceed the original (overlap duplicated)
    let joined: usize = chunks.iter().map(|c| c.chars().count()).sum();
    assert!(joined >= text.chars().count());
}

// ---------- note aggregation (Task 07 §7) ----------

#[test]
fn aggregation_strategies() {
    let mut scores = vec![0.9f32, 0.6, 0.3];
    let max = semantic::Aggregation::Max.aggregate(&mut scores.clone());
    assert!((max - 0.9).abs() < 1e-6);

    let top2 = semantic::Aggregation::Top2Weighted.aggregate(&mut scores.clone());
    assert!((top2 - (0.9 * 0.6 + 0.6 * 0.4)).abs() < 1e-6);

    let lse = semantic::Aggregation::LogSumExp.aggregate(&mut scores.clone());
    assert!(lse > 0.9 && lse < 0.9 + 1.0, "lse={lse}");

    let single = semantic::Aggregation::Max.aggregate(&mut vec![0.5]);
    assert!((single - 0.5).abs() < 1e-6);
}

// ---------- text semantic search (Task 07 §6, §9 acceptance) ----------

#[test]
fn text_semantic_search_ranks_by_cosine() {
    let mut store = open(&temp_db("semantic_search")).unwrap();
    let model = "bge-zh-int8";
    // n1's chunk vector is close to the query; n2's is far.
    import_with_chunk_embedding(&mut store, "n1", "白色建筑", "白色曲面建筑", model, &[1.0, 0.0, 0.0, 0.0]);
    import_with_chunk_embedding(&mut store, "n2", "美食", "潮汕牛肉丸", model, &[0.0, 0.0, 0.0, 1.0]);

    let query = [0.9, 0.1, 0.0, 0.0]; // nearest to n1
    let results = semantic::text_semantic_search(&store, &query, model, 10, semantic::Aggregation::Max)
        .unwrap();
    assert_eq!(results.len(), 2);
    assert_eq!(results[0].0, "n1");
    assert!(results[0].1 > results[1].1);

    // model mismatch guard: unknown model -> empty
    let empty = semantic::text_semantic_search(&store, &query, "no-such-model", 10, semantic::Aggregation::Max)
        .unwrap();
    assert!(empty.is_empty());
}

// ---------- image semantic search (Task 08 channel, used by Task 09) ----------

#[test]
fn image_semantic_search_ranks_by_cosine() {
    let mut store = open(&temp_db("image_search")).unwrap();
    notes::import_note(
        &mut store,
        &note("n1", "https://xhs.test/n1", "带图笔记", "正文", &[]),
        &[
            notes::NewImage { local_path: "media/n1/01.jpg", source_url: "", width: None, height: None, sha256: "a" },
            notes::NewImage { local_path: "media/n1/02.jpg", source_url: "", width: None, height: None, sha256: "b" },
        ],
        &[],
        "",
    )
    .unwrap();
    let image_ids: Vec<i64> = store
        .conn()
        .prepare("SELECT id FROM images ORDER BY id")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    embed::upsert_image_embedding(&store, image_ids[0], "cn-clip", &[1.0, 0.0], true).unwrap();
    embed::upsert_image_embedding(&store, image_ids[1], "cn-clip", &[0.0, 1.0], true).unwrap();

    let query = [0.99, 0.01];
    let results = semantic::image_semantic_search(&store, &query, "cn-clip", 5).unwrap();
    assert_eq!(results.len(), 2);
    assert_eq!(results[0].1, "n1");
    assert_eq!(results[0].0, image_ids[0]);
}

// ---------- RRF fusion (Task 09 §3) ----------

#[test]
fn rrf_fusion_combines_channels() {
    // a: n1 n2 n3 n4 | b: n3 n1 n2 | c: n2 n4
    // scores (k=60): n2=0.04897 > n1=0.03252 > n3=0.03226 > n4=0.03176 (unique order)
    let a = vec!["n1", "n2", "n3", "n4"];
    let b = vec!["n3", "n1", "n2"];
    let c = vec!["n2", "n4"];
    let fused = semantic::rrf_fuse(&[a, b, c], 60);
    assert_eq!(fused[0], "n2", "n2 appears in all three channels");
    assert_eq!(fused[3], "n4", "n4 has the lowest summed rank");
    assert!(fused.contains(&"n1") && fused.contains(&"n3"));
    assert_eq!(fused.len(), 4);
}

// ---------- full state machine + cancellation (Task 10) ----------

#[test]
fn full_ingest_flow_and_cancel() {
    let mut store = open(&temp_db("flow10")).unwrap();
    let job = notes::import_note(
        &mut store,
        &note("n1", "https://xhs.test/n1", "流程", "正文", &[]),
        &[],
        &[],
        "",
    )
    .unwrap();

    let flow = [
        ("RESOLVING", 10),
        ("DOWNLOADING_MEDIA", 25),
        ("OCR", 40),
        ("CHUNKING", 55),
        ("TEXT_EMBEDDING", 70),
        ("IMAGE_EMBEDDING", 85),
        ("FTS_INDEX", 95),
        ("READY", 100),
    ];
    for (state, progress) in flow {
        ingest::transition(&store, job, state, progress, "").unwrap();
    }
    let done = ingest::get_job(&store, job).unwrap().unwrap();
    assert_eq!(done.state, "READY");
    assert_eq!(done.progress, 100);
    assert!(ingest::is_terminal("READY"));

    // cancellation: a second job moves to CANCELLED and is terminal
    let job2 = notes::import_note(
        &mut store,
        &note("n2", "https://xhs.test/n2", "取消", "正文", &[]),
        &[],
        &[],
        "",
    )
    .unwrap();
    ingest::transition(&store, job2, "TEXT_EMBEDDING", 70, "").unwrap();
    ingest::cancel(&store, job2).unwrap();
    assert_eq!(ingest::get_job(&store, job2).unwrap().unwrap().state, "CANCELLED");
    assert!(ingest::is_terminal("CANCELLED"));

    // partial
    let job3 = notes::import_note(
        &mut store,
        &note("n3", "https://xhs.test/n3", "部分", "正文", &[]),
        &[],
        &[],
        "",
    )
    .unwrap();
    ingest::mark_partial(&store, job3, "2 张图片失败").unwrap();
    assert_eq!(ingest::get_job(&store, job3).unwrap().unwrap().state, "PARTIAL");

    // terminal jobs are never recovered
    let recovered = ingest::recover_interrupted(&mut store, &[]).unwrap();
    assert_eq!(recovered, 0);
}

// ---------- explainability helper (Task 09 §7) ----------

#[test]
fn chunk_embedding_lookup() {
    let mut store = open(&temp_db("explain")).unwrap();
    let chunk_id = import_with_chunk_embedding(
        &mut store,
        "n1",
        "标题",
        "可解释性 chunk",
        "bge",
        &[0.2, 0.4, 0.6, 0.8],
    );
    let vec = semantic::chunk_embedding(&store, chunk_id, "bge").unwrap().unwrap();
    assert!((vec[3] - 0.8).abs() < 1e-6);
    assert!(semantic::chunk_embedding(&store, 99999, "bge").unwrap().is_none());
}

// ---------- hybrid end-to-end (Task 09 §9 regression shape) ----------

#[test]
fn hybrid_pipeline_shape() {
    let mut store = open(&temp_db("hybrid")).unwrap();
    let model = "bge-zh";
    import_with_chunk_embedding(&mut store, "n1", "SANAA 美术馆", "金泽的环形玻璃幕墙建筑", model, &[1.0, 0.0]);
    import_with_chunk_embedding(&mut store, "n2", "潮汕菜", "牛肉丸弹牙", model, &[0.0, 1.0]);

    // Channel A: lexical
    let fts = search::fts_search(&store, "SANAA", 50).unwrap();
    assert_eq!(fts.len(), 1);
    let fts_rank: Vec<String> = fts.iter().map(|h| h.note_id.clone()).collect();

    // Channel B: text semantic (query vector nearest n1)
    let sem = semantic::text_semantic_search(&store, &[1.0, 0.1], model, 50, semantic::Aggregation::Max)
        .unwrap();
    let sem_rank: Vec<String> = sem.iter().map(|(id, _)| id.clone()).collect();

    // Fusion
    let fused = semantic::rrf_fuse(&[fts_rank.clone(), sem_rank], 60);
    assert_eq!(fused[0], "n1");
    assert!(fused.contains(&"n2".to_string()));
}
