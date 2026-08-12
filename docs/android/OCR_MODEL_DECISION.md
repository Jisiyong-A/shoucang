# OCR_MODEL_DECISION · 本地 OCR 引擎选型（Task 06）

Date: 2026-08-12
实测: `semantic-spike/ocr_bench.py`（自制中文测试集 6 类 × 双引擎）

## 决策

```text
SELECTED_OCR_ENGINE = RapidOCR (rapidocr_onnxruntime, PP-OCRv4 mobile det+rec+cls)
MODEL_SIZE          = 15.5MB (det 4.5MB + rec 10.4MB + cls 0.6MB)
LICENSE             = Apache-2.0（PaddleOCR 模型权重 Apache-2.0；RapidOCR 代码 Apache-2.0）
ANDROID_PATH        = ONNX Runtime + RapidOCR Java 绑定（rapidocr 官方支持 Java/C++）
REJECTED            = PP-OCRv5 server ONNX（164MB、质量更低、延迟 2.3×）
```

## 候选对比（实测，非只看 star）

| 维度 | PP-OCRv4 mobile (RapidOCR) | PP-OCRv5 server (monkt ONNX) | 权重 |
|---|---|---|---|
| 中文准确率（6 图 line recall） | **0.667** | 0.598 | 高 |
| 中英混排 | ✓（空格/大小写基本正确） | ✓ | 中 |
| 低对比 / 深色背景 | **1.00 / 1.00** | 1.00 / 1.00 | 高 |
| 小字号 | 0.67 | 0.67 | 高 |
| 建筑标注（数字+英文缩写） | 0.33（0→O 混淆） | 0.17（检测切行更碎） | 高 |
| 模型体积 | **15.5MB** | 164.6MB（10×） | 高 |
| PC CPU 延迟/图 | **1151ms** | 2681ms（2.3×） | 高 |
| Android ARM64 | ✓ ONNX + Java 绑定 | ✗ server 模型不适合移动 | 高 |
| 离线 | ✓ | ✓ | 必须 |
| 维护活跃 | ✓（v3.9.1 更新，2026 仍活跃） | ✓（转换仓库） | 高 |
| Redistributable | ✓ Apache-2.0 | ✓ Apache-2.0 | 必须 |

## 决策理由

1. **质量**：v4 mobile 在自制中文测试集全面≥ v5 server——server 模型检测粒度更碎（长行被切开），移动版在常见截图场景反而更稳。
2. **体积**：15.5MB vs 164.6MB——APK 体积权重高（Task 13 打包约束）。
3. **延迟**：移动端 CPU 相对 PC 慢 3-5×，v4 的 PC 1151ms 已接近移动端可接受上限边缘；v5 的 2.7s PC 延迟在手机上不可用。
4. **Android 集成**：RapidOCR 官方提供 Java/C++ 绑定 + ONNX Runtime（与 bge/CLIP 共用 ORT 运行时，Task 06 §4 考虑项 ✓）。
5. **许可**：模型与代码均 Apache-2.0（可再分发；OCR 模型许可记录见 MODEL_LICENSES.md 增补）。

## Android 集成设计（Task 06 §5 接口）

```text
ocr(imagePath) -> {
  "text": "...",                              // 全文
  "blocks": [{"text","confidence","box":[x1,y1,x2,y2]}],
  "engine": "rapidocr-ppocrv4-mobile",
  "version": "3.9.1"
}
```
- Rust 侧：`ocr_blocks` 表 + `set_image_ocr`（storage crate 已实现）
- Kotlin：RapidOCR Java 绑定跑在 worker 线程；失败 → `ocr_status=failed`（note 仍保存，Task 06 §6）
- OCR 文本 → FTS（refresh_note_fts 的 ocr 列）+ text chunker + embedding 索引（Task 06 §7，storage 已支持）

## 风险

- 数字/字母混淆（0↔O、x↔×）：PP-OCRv4 已知弱点；建筑图纸类内容（尺寸标注）受影响 → 记录为 P2，后续可评估 PP-OCRv5 mobile（官方 Paddle 格式，需要转换管道）
- v5 mobile ONNX 现成转换不存在（社区转换是 server 版）——如未来需要，转换管道是独立子任务
- 真机延迟未测（PC 数据 ×移动系数估算）；真机验收阶段补实测
