//! Task 12 backup/export/interop tests: export → import round trip,
//! desktop-schema field mapping, checksums, idempotency, reindex marker.

use std::path::PathBuf;

use kankan_storage::{backup, notes, open};

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kankan-storage-test-{name}"));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("store.db");
    let _ = std::fs::remove_file(&path);
    let _ = std::fs::remove_file(format!("{}-wal", path.display()));
    let _ = std::fs::remove_file(format!("{}-shm", path.display()));
    path
}

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kankan-backup-{name}"));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn note<'a>(id: &'a str, source_url: &'a str, title: &'a str, content: &'a str, tags: &'a [String]) -> notes::NewNote<'a> {
    notes::NewNote {
        id,
        source_url,
        title,
        raw_content: content,
        author_name: "作者A",
        author_id: "u1",
        category: "建筑",
        note_type: "normal",
        cover_url: "",
        likes: 0,
        collects: 0,
        comments: 0,
        saved_at: "2026-08-12T10:00:00Z",
        tags,
    }
}

// export writes manifest/notes/checksums with expected structure
#[test]
fn export_creates_payload_files() {
    let mut store = open(&temp_db("exp1")).unwrap();
    notes::import_note(
        &mut store,
        &note("n1", "https://xhs.test/n1", "标题一", "正文一", &["建筑".into(), "白色".into()]),
        &[notes::NewImage {
            local_path: "media/n1/01.jpg",
            source_url: "https://xhs.test/img1",
            width: None,
            height: None,
            sha256: "",
        }],
        &[],
        "",
    )
    .unwrap();
    store.set_setting("text_model_id", "bge-zh-int8").unwrap();

    let out = temp_dir("exp1");
    let manifest = backup::export_backup(&store, &out, false).unwrap();
    assert_eq!(manifest.format_version, backup::BACKUP_FORMAT_VERSION);
    assert_eq!(manifest.note_count, 1);
    assert_eq!(manifest.text_model_id.as_deref(), Some("bge-zh-int8"));

    let notes_json = std::fs::read_to_string(out.join("notes.json")).unwrap();
    assert!(notes_json.contains("标题一"));
    assert!(notes_json.contains("作者A"));
    assert!(notes_json.contains("建筑"));
    assert!(notes_json.contains("白色")); // tags
    assert!(notes_json.contains("media/n1/01.jpg")); // imageUrls (local_path)

    let checksums: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(out.join("checksums.json")).unwrap()).unwrap();
    assert!(checksums.get("notes.json").is_some());
    assert!(checksums.get("manifest.json").is_some());
    let sum = checksums["notes.json"].as_str().unwrap();
    assert_eq!(sum.len(), 64, "sha256 hex must be 64 chars");

    let manifest_json: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(out.join("manifest.json")).unwrap()).unwrap();
    assert_eq!(manifest_json["note_count"], 1);
}

// import restores notes/tags/images; re-import is idempotent
#[test]
fn import_round_trip_and_idempotent() {
    let mut store = open(&temp_db("exp2a")).unwrap();
    notes::import_note(
        &mut store,
        &note("n1", "https://xhs.test/n1", "标题一", "正文一", &["标签1".into()]),
        &[notes::NewImage {
            local_path: "media/n1/01.jpg",
            source_url: "https://xhs.test/img1",
            width: None,
            height: None,
            sha256: "",
        }],
        &[],
        "",
    )
    .unwrap();

    let out = temp_dir("exp2a");
    backup::export_backup(&store, &out, false).unwrap();
    let notes_json = std::fs::read_to_string(out.join("notes.json")).unwrap();

    // fresh store + import
    let mut store2 = open(&temp_db("exp2b")).unwrap();
    let count = backup::import_notes_json(&mut store2, &notes_json).unwrap();
    assert_eq!(count, 1);

    let n = notes::get_note(&store2, "n1").unwrap().unwrap();
    assert_eq!(n.title, "标题一");
    let images: i64 = store2
        .conn()
        .query_row("SELECT COUNT(*) FROM images WHERE note_id='n1'", [], |r| r.get(0))
        .unwrap();
    assert_eq!(images, 1);
    let tags: i64 = store2
        .conn()
        .query_row(
            "SELECT COUNT(*) FROM note_tags nt JOIN tags t ON t.id=nt.tag_id WHERE t.name='标签1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(tags, 1);

    // idempotent: importing the same payload again does not duplicate
    let count2 = backup::import_notes_json(&mut store2, &notes_json).unwrap();
    assert_eq!(count2, 1);
    let all: i64 = store2
        .conn()
        .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
        .unwrap();
    assert_eq!(all, 1);
}

// desktop notes.json (original schema) can be imported
#[test]
fn import_desktop_schema_notes() {
    let mut store = open(&temp_db("exp3")).unwrap();
    let desktop_json = r#"[
      {
        "id": "abc123",
        "sourceUrl": "https://www.xiaohongshu.com/explore/abc123",
        "title": "旧桌面数据",
        "rawContent": "桌面端导入的旧内容",
        "author": "旧作者",
        "category": "室内",
        "savedAt": "2025-01-01T08:00:00.000Z",
        "tags": ["旧标签"],
        "imageUrls": ["C:/old/media/1.jpg"]
      }
    ]"#;
    let count = backup::import_notes_json(&mut store, desktop_json).unwrap();
    assert_eq!(count, 1);
    let n = notes::get_note(&store, "abc123").unwrap().unwrap();
    assert_eq!(n.category, "室内");
}

// schedule_reindex flips index_status back to pending
#[test]
fn reindex_marker() {
    let mut store = open(&temp_db("exp4")).unwrap();
    notes::import_note(&mut store, &note("n1", "https://xhs.test/n1", "标题", "正文", &[]), &[], &[], "").unwrap();
    notes::set_index_status(&store, "n1", "indexed").unwrap();
    let updated = backup::schedule_reindex(&store).unwrap();
    assert_eq!(updated, 1);
    let n = notes::get_note(&store, "n1").unwrap().unwrap();
    assert_eq!(n.index_status, "pending");
}
