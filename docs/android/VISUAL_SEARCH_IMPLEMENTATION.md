# VISUAL_SEARCH_IMPLEMENTATION · 本地图文多模态检索实现（Task 08）

Date: 2026-08-12
模型: Chinese-CLIP ViT-B/16 uint8（Task 02 选定，MIT，512 维）
代码: `src-tauri/storage/src/semantic.rs`（image_semantic_search）+ `embed.rs`（image_embeddings）

## 1. 模型与预处理（§1-2）

- 模型固定为 Task 02 选型（本阶段不换模型）
- 预处理严格按 Xenova ONNX 转换规格：resize 224×224（short edge 等比 → center crop）、RGB、mean/std 归一化、text encoder 用 Chinese-CLIP 官方 tokenizer
- 任何偏差都会显著损伤 embedding（任务 §2）——集成时用 spike 的 `spike_lib.py ClipEmbedder` 参数对拍验证

## 2. 每图一个 embedding（§3）

```text
image → preprocess → CLIP image encoder → L2 normalize → image_embeddings
```
- **不做**"一篇 note 所有图片平均成一个向量"（单图信息保留）
- schema：image_embeddings(image_id PK, model_id, dims, normalized, vector_blob)——每图一行

## 3. Query 与检索（§4）

```text
用户中文 query → CLIP text encoder → visual-query vector → 与全部 image vectors 余弦
```
- `semantic::image_semantic_search(store, query_vec, model_id, top_k)` → (image_id, note_id, score)
- 暴力扫描（与文本通道一致，5k 图内可接受；ANN 触发条件与文本通道同步）

## 4. Result object（§5）

```json
{ "image_id": 12, "note_id": "abc123", "score": 0.72,
  "thumbnail": "media/abc123/01.jpg", "note_title": "标题" }
```
用户点击图片 → 回到所属 note（JOIN images.note_id）

## 5. OCR 与 Visual 分离（§6）

| 路线 | 内容 | 落点 |
|---|---|---|
| OCR | 图片里的**文字** | images.ocr_text + ocr_blocks + FTS ocr 列 |
| Visual embedding | 图片的**视觉内容** | image_embeddings（独立通道） |

两者都保留、不混淆：OCR 命中显示 OCR MATCH，视觉命中显示 VISUAL MATCH。

## 6. Dedup（§7）

- images.sha256 已入库（NewImage 字段）→ 相同图片跳过重复 embedding
- perceptual hash：可选（后续），sha256 精确去重优先

## 7. Ingest 性能（§8）

- 图片 embedding 在 ingest 阶段运行（IMAGE_EMBEDDING 状态，进度 05/08 IMAGES）
- 不阻塞 UI（worker 线程）；支持取消（ingest::cancel）；App 被杀可恢复（recover_interrupted）
- 保守并发（串行/2 并发，thermal §5）

## 8. Model memory（§9）

- CLIP 双塔合一 ONNX（text_embeds/image_embeds 同 session）→ **单 session 复用**
- 不每张图重新 load；lazy load + idle unload（模型 190MB，RAM 策略：查询时加载、空闲释放）
- 文本查询也喂 dummy pixel_values（Xenova 导出要求，spike 已验证）

## 9. 验收（§10，gold dataset）

| 指标 | 结果 |
|---|---|
| Image Recall@10（uint8） | **0.664**（目标 0.70，差 0.036——spike 已记录置信限） |
| nDCG@10（image） | 0.633 |
| query latency | ~94ms/图 embedding（PC）；query 文本编码 ~142ms cold |
| per-image index time | ~94ms PC |
| peak RAM | 真机待测 |

成功/失败案例见 `VISUAL_SEARCH_ERRORS.md`。

## 10. 与文本通道的关系

- 语义检索 = text_semantic_search（chunk 级）∪ image_semantic_search（image 级）→ RRF 融合（Task 09）
- 查询向量缓存（Task 07 §8）两个通道共用
