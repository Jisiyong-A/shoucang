# INDEXING_STATE_MACHINE · 可恢复索引 Pipeline（Task 10）

Date: 2026-08-12
实现位置: `src-tauri/storage/src/ingest.rs`

## 1. 状态机

```text
RECEIVED
   ↓
RESOLVING            （匿名解析 URL → 正文/图集）
   ↓
DOWNLOADING_MEDIA    （图片本地化，按白名单下载）
   ↓
OCR                  （本地 OCR，失败不阻塞保存 → ocr_status=failed 可重试）
   ↓
CHUNKING             （标题/正文/OCR/标签 分块）
   ↓
TEXT_EMBEDDING       （chunk → 文本向量）
   ↓
IMAGE_EMBEDDING      （图片 → 视觉向量，进度 05/08 IMAGES）
   ↓
FTS_INDEX            （notes_fts 重建，含中文 bigram）
   ↓
READY
```

错误/终态：

```text
PENDING_NETWORK — 网络瞬时失败，可重试（attempts+1，指数退避，不无限重试）
PARTIAL         — 部分媒体失败但 note 可用
FAILED          — 不可恢复错误
CANCELLED       — 用户删除 note / 主动取消
```

## 2. 持久化与恢复

- 每步 `ingest::transition` 更新 ingest_jobs（state/progress/error/updated_at）
- App 启动：`ingest::recover_interrupted(running_job_ids)` — 非终态且不在运行中的 job → RECEIVED（error='interrupted'）
- 实现要点：先 collect ids 再写库（避免迭代器游标干扰，见 STORAGE_TEST 记录）
- 分享原文保存在 `raw_share`，网络恢复后不丢用户操作

## 3. 前台优先（Demo）

Demo 阶段前台执行 + 真实进度（progress 0-100 + 每张图计数）。Beta 评估 WorkManager：

## 4. WorkManager 评估（Beta 决策点）

- network constraint **只用于** resolver/download（OCR/embedding 离线）
- unique work per note（同 note 不并发）
- 瞬时错误指数退避，上限 3 次，无无限重试
- 评估时机：真机后台行为验证时（Task 03 真机验收后）

## 5. Thermal / Battery

- 第一版：保守并发（图片 embedding 串行或 2 并发，避免打满核心）
- 预留 LOW_POWER / NORMAL 模式开关（settings 表）

## 6. Cancellation

- 删除 note：`notes::delete_note` 事务内删 job（CASCADE）+ `ingest::cancel` 显式置 CANCELLED
- 用户主动取消：UI → cancel()

## 7. Model Missing

- 模型未安装：note 保存 + index_status=pending；model_registry 安装后补跑索引（按 model_id 触发 reindex）

## 8. Idempotency

- 同 note 重复 import：`ON CONFLICT(id) DO UPDATE`（不重复创建）
- 图片：按 note_id 先 DELETE 再 INSERT（事务内）
- 向量：text_embeddings UNIQUE(entity_type, entity_id, model_id) upsert；image_embeddings 主键 upsert
- 重跑 job 不产生重复行（单测 `full_ingest_flow_and_cancel` 覆盖）

## 9. 验收（force close / relaunch）

| 场景 | 行为 |
|---|---|
| 每状态 force close → relaunch | recover_interrupted 重置非运行 job → RECEIVED，断点续跑 |
| READY 后 force close | 终态不恢复，不重复索引 |
| 网络断开 | PENDING_NETWORK + attempts，恢复后 retry |
| 删除 note 中断索引 | CANCELLED，无孤儿数据（delete 级联 + 显式清理） |
| 模型未装 | NOTE SAVED / INDEX PENDING，装后补跑 |

> 真机 force-close 实测需设备（Task 03 真机验收通道）；Rust 单测已覆盖状态机/恢复/幂等（14+8+3=25 项）。
