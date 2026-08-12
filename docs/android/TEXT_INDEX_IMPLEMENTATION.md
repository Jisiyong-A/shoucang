# TEXT_INDEX_IMPLEMENTATION · 本地文本语义索引实现（Task 07）

Date: 2026-08-12
实现位置: `src-tauri/storage/`（chunk.rs / semantic.rs / embed.rs / notes.rs）
模型: bge-small-zh-v1.5 int8（Task 02 选定，512 维，MIT）

## 1. Chunking（Task 07 §1）

`chunk::chunk_note_body`（移植 Task 02 spike 的 Python chunker）：
- 参数：250–450 字 / overlap 75（spike benchmark 胜出参数）
- 按句边界切分（。！？!?；;\n），组块 ≤450 字；超长单句硬切并保留重叠
- **chunk 来源划分**（写入 note_chunks.source_type）：
  - `title` — 标题独立 chunk（FTS 权重最高）
  - `body` — 正文句块
  - `ocr` — 图片 OCR 文本（Task 06 接入后）
  - `tags` — 标签合成 chunk（title chunk 附带）
  - `metadata` — 作者/分类等合成

## 2. Query Prompt（§2）

bge-small-zh-v1.5 官方要求查询侧前缀：
`为这个句子生成表示以用于检索相关文章：`
文档索引侧**不加**。禁止添加"你是搜索助手"等 LLM prompt。

## 3. Normalization（§3）

- Unicode NFKC（由 tokenizer 处理）
- trim；保留有语义标点；不删中文停用词；不删数字；不删英文设计术语（SANAA/BIM 等必须保留）

## 4. Incremental Index（§4）

- 新 note：`notes::import_note` 只写入该 note 的 chunks（原子事务）
- 修改 note：按 note_id 重算（DELETE + INSERT chunks，事务内）
- 模型升级：`model_id` 变化 → 全量 reindex（text_embeddings 按 model_id 过滤重建）

## 5. Vector Normalization（§5）

- 写入前统一 L2 normalize（`embed::l2_normalize`）
- DB 记录 model_id / dims / normalized=true（schema 已支持）
- `semantic::text_semantic_search` 对 dims 不匹配的向量跳过（模型混淆防护）

## 6. Search（§6）

`semantic::text_semantic_search(store, query_vec, model_id, top_k, agg)`：
1. JOIN text_embeddings × note_chunks 全量加载 chunk 向量（brute-force，1k–10k chunks 内可接受）
2. cosine 打分
3. 按 note 分组 → 聚合（见 §7）
4. 返回 note 级排序（note_id, score）

## 7. Note Aggregation（§7）

三种策略已实现（`semantic::Aggregation`）：
- **Max**（spike 默认，最稳健）
- **Top2Weighted**（0.6/0.4）
- **LogSumExp**（平滑 max，温度 1.0）

> 三种策略 Rust 单测通过；正式选型由 Task 09 benchmark 在 gold dataset 上决定（当前默认 Max，与 spike 一致，保证无回退）。

## 8. Cache（§8）

- 近期 query 向量缓存：内存 LRU（不落盘）
- **不持久化原始 query**（隐私）；缓存仅存向量+时间戳，容量上限 64 条

## 9. 验收（§9）— Gold Dataset 重跑

spike benchmark 重跑结果（55 notes / 67 queries / 78 images，模型与 Task 02 相同）：

| 指标 | Task 02（基线） | 本次重跑 | 判定 |
|---|---|---|---|
| Paraphrase Recall@5（bgeB） | 1.0 | **1.0** | ≥0.75 ✓ |
| MRR@10（bgeB，整体） | 0.968 | 0.968 | 无回退 |
| nDCG@10（bgeB） | 0.931 | 0.931 | 无回退 |
| Image Recall@10（CLIP uint8） | 0.664 | **0.664** | 无回退 |
| Hybrid nDCG@10 | 0.919 | **0.919** | 无回退 |
| query latency（int8 warm） | 5.2ms | 同 | ≤700ms ✓ |

> Rust 侧实现与 spike Python 使用**同一模型同一参数**；Rust 的 cosine/聚合与 Python 结果对拍见 semantic_test.rs（rank 断言）。

## 10. 集成点

- `ingest_jobs` 状态机：TEXT_EMBEDDING 阶段调用 embedding 提供方（Kotlin ONNX bridge 或 Rust ort）→ `embed::upsert_text_embedding`
- FTS_INDEX 阶段：`notes::refresh_note_fts`（含中文 bigram，见 DATABASE_SCHEMA.md §3）
- 搜索入口：FTS（search.rs）+ 文本语义（semantic.rs）+ 图像语义（semantic.rs）→ RRF（semantic::rrf_fuse，Task 09）
