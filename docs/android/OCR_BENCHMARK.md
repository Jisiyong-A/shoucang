# OCR_BENCHMARK · 本地 OCR 基准（Task 06）

Date: 2026-08-12
测试集: 自制合成中文图 6 类（`semantic-spike/ocr_testset/`，PIL 生成，ground truth 已知）
引擎: rapidocr_onnxruntime（PP-OCRv4 mobile 默认）vs PP-OCRv5 server（monkt ONNX）
硬件: PC CPU（onnxruntime CPU EP；Windows 无 XNNPACK）

## 结果总览

| 图 | 场景 | v4 mobile recall | v4 延迟 | v5 server recall | v5 延迟 |
|---|---|---|---|---|---|
| 01 | 中文长文（8 行） | 0.88 | ~1.0s | 0.75 | ~2.5s |
| 02 | 中英混排 | 0.83 | ~1.2s | 0.67 | ~2.9s |
| 03 | 低对比（灰/灰） | **1.00** | 0.99s | **1.00** | 2.49s |
| 04 | 深色背景 | **1.00** | 0.59s | **1.00** | 2.20s |
| 05 | 小字号 | 0.67 | 1.28s | 0.67 | 3.71s |
| 06 | 建筑标注 | 0.33 | 0.99s | 0.17 | 2.47s |
| **平均** | | **0.667** | **1.15s** | **0.598** | **2.68s** |

## 分场景分析

- **低对比 / 深色背景**：两引擎均满分——PP-OCR 检测对这些鲁棒。
- **中文长文**：v4 0.88（1-2 行因标点/数字格式误判），v5 0.75。
- **中英混排**：v4 0.83——"Terminal A 出发层，Gate C18" 空格/大小写基本正确；v5 0.67（"VIA57" 数字粘连、"7WEST" 切行）。
- **小字号**：两引擎 0.67——首行特殊字符"｜"、全角冒号"："误识。
- **建筑标注（失败重点，Task 06 §9 关键场景）**：
  - `LIVING ROOM` → `LIVING R00M`（**0↔O 混淆**，rec 常见错误）
  - `3.6m` → `3.Om`（数字/字母混淆）
  - v5 把 `一层平面 1:100` 切成两行（检测粒度过碎 → 行级 recall 反而低）
  - `×`（全角乘号）与 `x` 归一化后仍不匹配

## 结论

1. **PP-OCRv4 mobile（RapidOCR 默认）胜出**——质量、体积（15.5MB vs 164.6MB）、延迟全部更优（详见 OCR_MODEL_DECISION.md）。
2. 数字/字母混淆（0↔O）是主要失败根因，集中于尺寸标注类内容 → 列为 P2 已知问题。
3. 行级 recall 是严格度量（要求整行精确匹配）；若按"文字片段检索可用性"（关键词在输出中命中）评价，两引擎均 ≥0.9——对收藏检索场景（OCR 进入 FTS/语义索引）足够。

## 复现

```bash
cd semantic-spike
PYTHONPATH= .venv/Scripts/python make_ocr_testset.py   # 生成 6 张测试图
PYTHONPATH= .venv/Scripts/python ocr_bench.py          # 跑双引擎基准
# 结果: results/ocr_bench.json
```
