# QA_REPORT · Android 版全量 QA（Task 14）

Date: 2026-08-12

## 1. 自动测试（§1）

| 套件 | 结果 |
|---|---|
| JS tests（桌面仓库） | **65 pass / 1 skip / 0 fail**（66 tests） |
| Rust tests（storage crate） | **29/29 pass**（chunk 3 + backup 4 + semantic 8 + storage 14） |
| Scale test（100/500/1000 notes） | 3/3 pass（见 RETRIEVAL_FINAL_BENCHMARK.md） |
| OCR benchmark（双引擎×6 场景） | 完成（OCR_BENCHMARK.md） |
| Android unit / instrumentation | ⏸ 需真机 + Kotlin 工程（Task 03/04 真机验收通道） |
| DB migration tests | ✅ migrate_idempotent / corruption_detected |

## 2. E2E（§2）状态

| # | 场景 | 状态 |
|---|---|---|
| A | share URL → note saved | ⏸ 真机（Kotlin Sharesheet 未实现，Task 04） |
| B | images local | ⏸ 真机 |
| C | OCR local | ✅ PC 验证（PP-OCRv4 mobile 离线跑通）；真机待设备 |
| D | exact keyword search | ✅（FTS5 + 中文 bigram，R@5=1.0） |
| E | paraphrase semantic search | ✅（bgeB R@5=1.0） |
| F | text→image visual search | ✅ image 级（CLIP uint8 R@10=0.664） |
| G | offline search | ⏸ 真机飞行模式（设计上零网络，PRIVACY_AUDIT.md §3） |
| H | force close during OCR/index → resume | ✅ Rust 状态机（recover_interrupted + 测试）；真机 force-close 待设备 |
| I | backup → restore | ✅ Rust round-trip（backup_test 4 项）；真机流程待设备 |

## 3. 错误注入（§10）

| 注入 | 状态 | 证据 |
|---|---|---|
| DB 损坏 | ✅ | corruption_detected 测试（明确报错，不静默） |
| DB 迁移失败 | ✅ | migrate_idempotent（新版本拒绝） |
| 模型缺失 | ✅ 设计 | model_registry installed_state + INDEX PENDING（INDEXING_STATE_MACHINE §7） |
| 模型损坏 | ✅ 设计 | SHA-256 启动校验（PRIVACY_AUDIT §5）；实测待真机 |
| 中断 ingest | ✅ | recover_interrupted（迭代器 bug 已修，STORAGE_TEST 记录） |
| 重复导入（幂等） | ✅ | backup_test idempotent + ON CONFLICT upsert |
| 网络不可用 | ✅ 设计 | PENDING_NETWORK 状态机 |
| 磁盘满 / 超大图 / 不支持格式 | ⏸ | 真机阶段（Kotlin 侧处理） |
| 坏分享文本 / 重定向环 | ⏸ | Task 04 解析层（未实现） |

## 4. 严重级别（§11）

| 级别 | 数量 | 说明 |
|---|---|---|
| P0（数据丢失/隐私/崩溃循环） | **0** | — |
| P1（导入/搜索/OCR/语义核心坏） | **0** | 已实现路径全部通过 |
| P2（UX/性能） | 2 | OCR 0↔O 数字混淆（尺寸标注）；10k chunks 查询 169ms PC |
| P3（视觉） | 0 | — |

## 5. 设备矩阵 / 性能（§6-7）

- 真机未连接 → 设备矩阵与移动端性能（cold start / model load / RAM / battery）**PENDING**（Task 03 真机验收通道）
- PC 基准已覆盖：DB open <10ms、text query 5-169ms、image embed 94ms、OCR 1.15s

## 6. 已知限制（如实）

1. note 级三通道 hybrid 的严格指标需真实语料（spike 为合成数据，图像通道 image 级验证）
2. Kotlin 层（Sharesheet/OCR worker/Model Pack UI）未实现——依赖真机与 Task 03/04 通道
3. 移动端延迟为 PC×系数估算，非实测
