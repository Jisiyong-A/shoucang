# HYBRID_RANKING · 三通道 Hybrid 检索与排序（Task 09）

Date: 2026-08-12
实现位置: `src-tauri/storage/src/semantic.rs`（rrf_fuse）+ search.rs（FTS5）

## 1. Retrieval Channels

| 通道 | 实现 | 排序依据 |
|---|---|---|
| A. Lexical | `search::fts_search`（FTS5 unicode61 + 中文 bigram + BM25 字段权重） | bm25 加权分 |
| B. Text Semantic | `semantic::text_semantic_search`（chunk 向量 cosine → note 聚合） | cosine（Max/Top2/LSE） |
| C. Image Semantic | `semantic::image_semantic_search`（image 向量 cosine） | cosine |

## 2. Candidate Generation

- FTS top 50（按 title>tags>body>ocr>author 惩罚权重）
- Text semantic top 50 chunks（聚合到 note）
- Image semantic top 50 images（映射到 note）
- 合并去重 → note 级候选池；图像通道额外保留 image_id 供 IMAGE 结果展示

## 3. Fusion — RRF（选定）

`semantic::rrf_fuse(ranked_lists, k=60)`：
```
score(item) = Σ 1/(k + rank)
```
- 各通道 raw score 尺度不同（BM25 负值 vs cosine 0..1），RRF 只用 rank，天然同尺度
- **禁止直接相加 cosine + BM25**（已明确拒绝）
- 备选 normalized weighted score：留作 Task 09 benchmark 对照（未实现，因 RRF 已满足回归要求）

## 4. Field Boosts

- exact title hit：FTS title 权重已最小（0.2 惩罚 = 最高优先）
- tag exact / category exact / source exact：tag/category 在 FTS 独立列已覆盖；source_url 精确匹配由 lexical 通道的 URL token 命中
- 专有名词（SANAA/BIM/北海道）：lexical 通道保证不退化（spike Q1 Exact 类 Recall@5=1.0）

## 5. Query Type（轻量规则，第一版）

```text
exact/named-entity  — 含拉丁词/数字/专名 → 提高 lexical 权重
descriptive         — 纯中文长句 → 提高语义权重
visual              — 空间/材质/颜色词（白色/木质/庭院…）→ 提高图像通道
mixed               — 默认均权
```
不引入本地 LLM 做 routing。

## 6. Results UX

- 两类结果：ARTICLES（note 卡片）/ IMAGES（缩略图网格，点击回所属 note）
- 过滤：ALL / ARTICLES / IMAGES / OCR（OCR 命中 = image.ocr_text 非空且命中）
- 命中理由标签（不暴露 raw score）：
  - TITLE MATCH（FTS title 列命中）
  - SEMANTIC MATCH（文本语义命中）
  - OCR MATCH（OCR 文本命中）
  - VISUAL MATCH（图像语义命中）

## 7. Explainability Debug 模式

`chunk_embedding(chunk_id, model_id)` 已实现（取回单 chunk 向量）。调试显示：
```
fts rank=3  text score=0.82  image score=—  fusion rank=1  matched chunk="…"
```
release 默认隐藏。

## 8. Semantic Threshold

- FTS 命中天然有 BM25 下限；语义通道设 relevance floor（cosine < 0.25 不进入候选，待 benchmark 校准）
- 无高质量结果时显示「没有找到足够相关的收藏」，不随机返回

## 9. Evaluation 分类型统计

基准见 `HYBRID_SEARCH_BENCHMARK.md`；四类（Exact/Paraphrase/Visual/Hard Negative）分开统计，避免 overall 掩盖问题。

## 10. Regression 门槛

| 要求 | 状态 |
|---|---|
| 精确关键词不明显退步（Q1） | lexical 通道保留，Q1 R@5=1.0 ✓ |
| paraphrase 明显优于 lexical（Q2） | bgeB R@5=1.0 vs lexical 0.85 ✓ |
| visual query 找到无文字图片（Q3） | 图像通道 R@10=0.664（差距见 SEMANTIC_SPIKE_REPORT §7） |

## 已知边界

- note 级三通道融合的诚实验证受限于 spike 合成语料（notes 无真实图片关联）；图像通道在 image 级独立验证。真机/真实语料阶段（Task 14 QA）补 note 级三通道指标。
- BM25 短字段（title）线性权重无法严格保证排序（见 DATABASE_SCHEMA.md §4），Task 09 benchmark 校准项。
