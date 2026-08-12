# OCR 引擎选型报告 — OCR_DECISION

> 2026-08-12 · Task 04 · windows-redesign

## 1. 现有环境检查（Task 04 §1）
| 检查点 | 结果 |
|---|---|
| PATH OCR CLI | 无 tesseract / paddleocr / rapidocr CLI |
| Python 环境 | `python` 与 `py` 均装有 **rapidocr_onnxruntime**；`py` 另有 pytesseract、easyocr（开发机可用，但按 §5 不能要求终端用户装 Python） |
| Hermes workspace | `/d/hermes/ocr_bw.png`、`ocr_section1.png`、`ocr_section2.png`（历史 OCR 测试图，非引擎） |
| 已下载模型 | 无独立模型目录 |
| 常见 OCR CLI | Program Files 无 Tesseract-OCR |

## 2. 候选对比（Task 04 §3）
| Candidate | Chinese | Offline | Windows | Runtime | Size | License | Activity | Packaging | Score |
|---|---|---|---|---|---|---|---|---|---|
| **Windows.Media.Ocr（WinRT）** | ✅ zh-Hans-CN 实测 | ✅ | ✅ 系统内置 | 无（OS 组件） | 0（随 OS） | OS 组件 | 随 Windows 更新 | 仅 1 个 ps1 桥 | **9.5/10** |
| RapidOCR (ONNX) | ✅ 强 | ✅ | ✅ | Python/onnxruntime | 模型 ~20-40MB | Apache-2.0 | 活跃 | 需 PyInstaller 或 onnxruntime 打包 | 7.5/10 |
| PaddleOCR | ✅ 最强 | ✅ | ✅ | PaddlePaddle | 模型大 ~100MB+ | Apache-2.0 | 活跃 | 重，打包复杂 | 6.5/10 |
| Tesseract | ⚠️ 中文可但质量一般 | ✅ | ✅ | tesseract.exe | 引擎+chi_sim ~15MB | Apache-2.0 | 维护中 | 需捆绑 exe + traineddata | 6/10 |

评分权重：分发零依赖 > 中文质量 > 体积 > 打包复杂度（本产品是面向普通用户的本地桌面 App）。

## 3. 结论
```text
SELECTED_OCR=windows (Windows.Media.Ocr via scripts/windows-ocr.ps1)
WHY=
  - 完全本地、中文优先（zh-Hans-CN 实测可用，跟随系统语言包）
  - 零额外依赖：引擎是 Windows 10 1809+/11 内置组件，无模型文件、无 Python、
    无管理员权限要求，安装包零增量（§5 天然满足：没有 python ocr.py，只有 Tauri 调 ps1 桥）
  - 图片格式：WinRT BitmapDecoder 原生支持 AVIF/GIF/HEIC/HEIF/JPEG/PNG/WEBP
    （§7 无需预处理层）
  - 许可证：Windows 系统组件，无再分发风险；桥脚本为本仓库 AGPL-3.0 代码
FALLBACK=rapidocr (scripts/ocr/ 可插拔接口已预留；若目标机 WinRT 语言包缺失
  或未来需要更强版面分析，可新增 rapidocr adapter 并随包捆绑 ONNX 模型，
  Apache-2.0 允许分发；须记录模型 checksum)
```

## 4. 架构（§4）
```
media-import (scripts/lib/media-import.mjs)
    ↓ runOcr(imagePaths, {concurrency})
scripts/ocr/index.mjs         ← facade（业务代码不知道引擎细节）
    ├── types.mjs             结果/元数据结构
    ├── normalize.mjs         CJK 空格规范化 + 输出解析
    ├── macos-vision.mjs      darwin → Vision (JXA)
    └── windows-local.mjs     win32 → Windows.Media.Ocr (ps1 桥) + probe
统一输出: [{path, text, confidence?, error}]（confidence 不可得时省略）
runOcr 额外返回 {engine, engineVersion} 供持久化（§9 缓存元数据）
```

## 5. 缓存（§9）
- 已有结果（imageOcr / ocrText）随 notes.json 持久化，启动/重启不重跑
- 新增持久化元数据：`ocrEngine` / `ocrEngineVersion` / `ocrProcessedAt`
  ——引擎版本升级时可据此触发重识别
- 实测：启动 local-api 前后 notes.json 哈希一致（RESTART_NO_REOCR ✓）

## 6. 并发/超时（§10/§11）
- 单次调用 = 单 PowerShell 进程内顺序识别（等价 1 worker，引擎实例复用）
- 单图失败不中断：ps1 每图 try/catch，结果带 per-image error；media-import 汇总
  mediaStatus: ready / partial（失败张数 + OCR 错误写入 mediaError，UI 显示 MEDIA? 徽标）

## 7. 许可记录（§15）
| 组件 | License |
|---|---|
| scripts/ocr/*（本仓库代码） | AGPL-3.0-or-later |
| scripts/windows-ocr.ps1（桥） | AGPL-3.0-or-later（随仓库） |
| Windows.Media.Ocr | Windows OS 组件（终端用户系统自带，无再分发） |
| PowerShell | Windows 内置 |
| （未来 fallback）RapidOCR | Apache-2.0（允许分发；模型文件需附 checksum） |
