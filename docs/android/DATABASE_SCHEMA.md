# DATABASE_SCHEMA · SQLite 知识库 Schema（Task 05）

Date: 2026-08-12
实现: `src-tauri/storage/` 独立 crate（rusqlite 0.40 bundled + FTS5）

## 1. 选型

- **rusqlite bundled**：SQLite C 源码随 crate 编译，Android arm64 交叉编译走 NDK clang（与 Tauri 构建链一致），无系统依赖。
- **FTS5**：bundled 构建默认启用。
- **WAL**：`PRAGMA journal_mode=WAL`（读者不阻塞写者，Android filesDir 安全）。
- **Migrations**：`PRAGMA user_version`，每版一个事务批（见 schema.rs MIGRATIONS）。
- **Corruption**：打开/迁移失败快速报错（`file is not a database` 等透传）；提供 `integrity_check()` 探针。
- **Vector search**：向量存 BLOB（f32 LE 原字节），Rust 暴力余弦——1k–10k chunk 足够；ANN（sqlite-vec/HNSW）仅在 benchmark 证明需要时引入。

## 2. 表结构（v1）

### notes
| 列 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | 规范化 note id（24 位 hex） |
| source_url | TEXT | 规范 URL（去 query/hash） |
| title / raw_content | TEXT | |
| author_name / author_id | TEXT | |
| category | TEXT | 默认 待分类 |
| type | TEXT | normal/video |
| cover_url | TEXT | |
| likes/collects/comments | INT | |
| media_status | TEXT | none/pending/ready/partial/failed |
| index_status | TEXT | pending/chunked/embedded/indexed/failed |
| saved_at / updated_at | TEXT | ISO-8601 |

### images
id AUTOINCREMENT PK · note_id FK **ON DELETE CASCADE** · local_path · source_url · width/height · ocr_text · ocr_status(pending/done/failed) · embedding_status · sha256

### note_chunks
id PK · note_id FK CASCADE · chunk_index · source_type(**title/body/ocr/tags/metadata**) · text · start_offset/end_offset

### ocr_blocks
id PK · image_id FK CASCADE · text · confidence · box_x1/y1/x2/y2

### text_embeddings
id PK · entity_type(note/chunk/ocr) · entity_id · model_id · dims · normalized · vector_blob
> 多态实体 → **无外键**；删除 note 时显式清理（notes::delete_note 事务内）
> UNIQUE(entity_type, entity_id, model_id) 支持模型升级重索引

### image_embeddings
image_id PK FK CASCADE · model_id · dims · normalized · vector_blob

### tags / note_tags
name UNIQUE · (note_id, tag_id) PK，级联删除

### ingest_jobs
id PK · note_id FK CASCADE · state(RECEIVED/RESOLVING/MEDIA/OCR/TEXT_EMBEDDING/IMAGE_EMBEDDING/INDEXED/FAILED/PENDING_NETWORK) · raw_share · error · progress · attempts · created_at/updated_at

### settings
key PK · value

### model_registry
model_id PK · kind(text/image_text/ocr) · version · license · local_path · sha256 · installed_state · installed_at

### notes_fts（FTS5 虚拟表）
note_id UNINDEXED · title · body · ocr · tags · author · category
`tokenize = 'unicode61 remove_diacritics 2'`

## 3. 中文 FTS 策略（重要）

unicode61 把整段连续中文当作**一个 token**（"金泽二十一世纪美术馆的环形玻璃幕墙" = 1 token），子串查询（"金泽"）无法命中。

**方案：CJK 2-gram 预处理**（`notes::cjk_bigrams`）：
- 索引侧：title/body/ocr/tags/author 中文字段在写入 FTS 前切成 2-gram 空格分隔（"金泽二十一" → "金泽 泽二 二十 十一"）；非 CJK 原样保留。
- 查询侧：同一函数处理 query（"金泽" → "金泽"；"金泽美术馆" → "金泽 泽美 美术 术馆"），term 以 OR 组合。
- 效果：任意 ≥2 字中文子串可命中；英文/数字不受影响。
- 代价：FTS snippet 显示 bigram（后续 Task 09 可优化为原文 snippet）。

## 4. BM25 字段权重

```text
title(0.2) < tags(0.8) < body(1.0) < ocr(1.2) < author(1.5) = category(1.5)
```
bm25() 权重是**惩罚系数，越小越重要**；按 FTS 列顺序位置传参（含 UNINDEXED 的 note_id=0.0）。
注意：短字段（title）BM25 分数离散度大，线性权重无法完全保证"标题命中排最前"——精确排序校准留到 Task 09 用 gold dataset 调。

## 5. 原子导入 & 恢复

`notes::import_note` 在一个事务内写入：note + images + chunks + tags + FTS 行 + ingest job(RECEIVED)。
- App 任意时刻被杀 → DB 要么完整（commit 后），要么无痕（rollback），**不会留下无法判断的半成品**。
- 启动时 `ingest::recover_interrupted(running_job_ids)`：非终态且不在运行中的 job 重置为 RECEIVED（error='interrupted'），断点续跑。
- 网络失败 → `mark_retryable`（PENDING_NETWORK + attempts+1），分享原文保留在 raw_share 不丢失。
- 删除 note：事务内先删 FTS 行，再显式清 text_embeddings（多态），再删 notes（级联 images/chunks/jobs/tags）。

## 6. 与桌面 note schema 兼容

桌面 notes.json 字段（id/sourceUrl/title/content/rawContent/author/imageUrls/imageOcr/tags/category/savedAt/type/mediaStatus/mediaError）在 notes/images/note_chunks/ocr_blocks 中一一映射；导入导出映射函数为 Task 12 接口预留。

## 7. 测试清单（STORAGE_TEST.md 详述）

14 项测试全部通过：create/migrate(含幂等+新版拒绝)/insert/FTS(含中文 bigram)/vector round-trip/cascade/rollback/recover/ingest 状态机/settings+registry/WAL/FK/corruption。
