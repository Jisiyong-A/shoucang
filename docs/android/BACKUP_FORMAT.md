# BACKUP_FORMAT · 便携备份格式（Task 12）

Date: 2026-08-12
实现: `src-tauri/storage/src/backup.rs`（export/import/schedule_reindex + 4 项测试）

## 1. `.kankan-backup` 格式

本质为 ZIP（平台层用 Kotlin/java.util.zip 或 zip crate 打包），内部结构：

```text
kankan-backup/
├── manifest.json      # 格式版本 / 导出时间 / app 版本 / note 数 / 模型版本
├── notes.json         # 桌面兼容 schema 的 JSON 数组（字段见 §3）
├── media/             # 可选（full backup）：图片文件，按原名
└── checksums.json     # 每个 payload 文件的 SHA-256（hex）
```

### manifest.json
```json
{
  "format_version": 1,
  "exported_at_epoch_secs": 1787800000,
  "app_version": "0.1.0",
  "note_count": 147,
  "media_included": false,
  "text_model_id": "bge-zh-int8",
  "image_model_id": "cn-clip-vit-b16-uint8"
}
```

### checksums.json
```json
{ "notes.json": "<sha256 hex>", "manifest.json": "<sha256 hex>" }
```
导入前校验：notes.json 的 SHA-256 必须匹配（Task 13 §4 模型/数据校验一致）。

## 2. 导出（`backup::export_backup`）

- `include_media=false`（默认）：仅元数据——notes、OCR 文本、分类、标签、图片路径
- `include_media=true`：额外复制 media/ 图片文件
- **不导出 embeddings**：可重建、模型升级后失效、体积大（§4）；manifest 记录模型版本，导入后 `schedule_reindex` 触发重建

## 3. 桌面 note schema 兼容（§3）

notes.json 字段与桌面原始 notes.json 一一映射：

| 备份字段 | 桌面字段 | storage 表 |
|---|---|---|
| id | id | notes.id |
| sourceUrl | sourceUrl | notes.source_url |
| title | title | notes.title |
| rawContent | rawContent | notes.raw_content |
| ocrText | ocrText（桌面合并字段） | images.ocr_text 拼接 |
| imageUrls | imageUrls/sourceImageUrls | images.local_path 列表 |
| author / authorId | author | notes.author_name / author_id |
| tags | tags | tags + note_tags |
| category | category | notes.category |
| savedAt | savedAt | notes.saved_at |
| mediaStatus | mediaStatus | notes.type（video 映射） |

## 4. 导入（`backup::import_notes_json`）

- 逐条 upsert（幂等：同 id 重导不重复，测试覆盖）
- 图片路径按原样写入 images.local_path（Android 上路径需重映射——Task 12 §5 说明：导入后 media 重新落盘由 ingest 阶段处理）
- 导入后调用 `schedule_reindex()`：所有 note index_status → pending，索引管线重建

## 5. Future sync boundary（§6）

本阶段**无云同步**。ADR 中定义的未来边界：

```text
Android capture ↔ optional user-controlled sync ↔ Windows knowledge workstation
```

不实现账号系统；备份文件即互操作载体（Android 导出 → 桌面导入路径为 Task 12 后续项）。

## 6. 验收（§7）状态

| 项 | 状态 |
|---|---|
| export | ✅ Rust 实现 + 测试（payload 结构 / checksums / 字段映射） |
| wipe + reinstall + import | ⏸ 需真机（Android 侧流程）；Rust 侧 import round-trip ✅ |
| notes restored | ✅ 测试覆盖 |
| images restored (full) | ⏸ 媒体复制逻辑实现，真机验收待设备 |
| semantic index rebuilt | ✅ schedule_reindex + 测试 |

## 7. 复现

```bash
cd src-tauri/storage && cargo test --test backup_test   # 4 项
```
