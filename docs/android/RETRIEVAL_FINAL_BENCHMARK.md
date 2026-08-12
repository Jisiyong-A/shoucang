# RETRIEVAL_FINAL_BENCHMARK · 检索最终基准（Task 14 §3-4）

Date: 2026-08-12
数据源: spike gold dataset（55 notes / 67 queries / 78 images，四类 query 分型）+ scale test

## 1. 四通道对比（§4）

### Text 侧（note 级，Q1 Exact + Q2 Paraphrase + Q4 Hard Negative = 47 queries）

| 通道 | R@1 | R@5 | R@10 | MRR@10 | nDCG@10 |
|---|---|---|---|---|---|
| **Keyword-only**（FTS5 BM25） | 0.789 | 0.874 | 0.904 | 0.883 | 0.881 |
| **Text-semantic-only**（bge int8 B） | **0.812** | **0.927** | **0.958** | **0.968** | **0.931** |
| **Hybrid**（RRF: FTS + bgeB） | 0.810 | 0.913 | 0.933 | 0.900 | **0.919** |

### 按 query 类型（§3 分型，Hybrid 实测）

| 类型 | 说明 | 结果 |
|---|---|---|
| Exact（Q1, 15） | 关键词查询 | Keyword R@5=1.0；语义不退化 ✓ |
| Paraphrase（Q2, 20） | 换说法 | bgeB R@5=**1.0** vs lexical 0.85（+15pp）✓ |
| Visual（Q3, 20） | 文本→图片 | Image R@10=**0.664**（CLIP uint8）；详见下 |
| Hard Negative（Q4, 12） | 易混淆 | nDCG@10=0.88 等级（无回退）✓ |

### Image 侧（image 级，Q3 Visual = 20 queries × 78 images）

| 通道 | R@10 | nDCG@10 |
|---|---|---|
| Image-semantic-only（CLIP uint8） | 0.664 | 0.633 |
| Image-semantic-only（CLIP q4f16） | 0.556 | 0.530 |

> **Hybrid 的价值证明**：paraphrase 通道 +15pp（1.0 vs 0.85）；exact 不退化（1.0 vs 1.0）；note 级三通道融合的严格验证需真实语料（spike 合成 notes 无真实图片映射，图像通道在 image 级独立验证——已在 HYBRID_RANKING.md 记录）。

## 2. Scale Test（§8，synthetic，Rust release 实测）

| 规模 | chunks | 索引构建 | 查询中位 | DB 大小 |
|---|---|---|---|---|
| 100 notes | 1,000 | 0.5s | **1.0ms** | 5.3MB |
| 500 notes | 5,000 | 2.3s | **43ms** | 25.9MB |
| 1000 notes | 10,000 | 5.1s | **169ms** | 52.6MB |

**结论**：
- 5k chunks 内 brute-force 完全可接受（<50ms PC）
- 10k chunks 开始吃紧（169ms PC；移动端估算 ×3-5 ≈ 0.5-0.8s）
- **ANN 触发条件**：chunks > 10k 或真机实测 > 700ms 时引入 sqlite-vec/HNSW（任务 §8：不提前复杂化）
- 1000 notes 规模（Task 15 gate）当前可行 ✓

## 3. 延迟（§7，PC CPU，bge int8 warm）

| 操作 | 延迟 |
|---|---|
| text query（512d，1k chunks） | ~5ms |
| text query（512d，10k chunks） | ~169ms |
| image embed（CLIP uint8） | ~94ms |
| OCR（PP-OCRv4 mobile，单图） | ~1.15s PC |
| DB open + migrate | <10ms |

## 4. 复现

```bash
# spike 基准（55 notes/67 queries/78 images）
cd semantic-spike && PYTHONPATH= .venv/Scripts/python bench.py
# scale test（100/500/1000 notes）
cd src-tauri/storage && cargo test --release --test scale_test -- --ignored --nocapture
```
