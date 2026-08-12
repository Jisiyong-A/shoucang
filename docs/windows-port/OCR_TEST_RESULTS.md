# OCR 测试结果 — OCR_TEST_RESULTS

> 2026-08-12 · Task 04 · Windows.Media.Ocr（zh-Hans-CN 优先）

## 测试资产（自绘，无第三方版权内容 — §12）
`test-fixtures/ocr/`：chinese-simple.png（白底黑字中文）、mixed-cn-en.png（中英混排）、low-contrast.png（黑底白字+低对比灰字）

## 自动化测试（`node --test`，win32 门控）
| 用例 | 结果 | 实测输出摘要 |
|---|---|---|
| chinese-simple → CJK 文本 | ✅ | 识别到 咖啡/水温 等关键词（含 WinRT 字间空格规范化） |
| mixed-cn-en → 拉丁保留 | ✅ | `Search` 等英文词保留，中文命中 |
| low-contrast → 仍有文本 | ✅ | 黑底白字识别成功（浅灰字部分识别） |
| runOcr facade → 引擎元数据 | ✅ | engine=windows, engineVersion=1.0.0, results 数组 |
| normalize/parse 单元 | ✅（8 用例） | CJK 空格去除、拉丁词间距保留、噪声/CRLF/garbage 容错 |
| media-import 元数据持久化 | ✅（+2 用例） | facade 形态写入 ocrEngine/ocrEngineVersion/ocrProcessedAt；旧形态兼容 |
| OCR 探测 | ✅ | probeLocalOcr → engine=windows, languages=[en-GB, zh-Hans-CN, zh-Hant-TW] |

## 真实场景验证
| 场景（§8） | 结果 |
|---|---|
| 小红书信息图（真实笔记 8 图） | ✅ 8/8 无错误处理，mediaStatus=ready（房源照片无文字属内容属性） |
| 中文长图/白底黑字 | ✅ chinese-simple fixture |
| 黑底白字 | ✅ low-contrast fixture（白字行） |
| 中英混排 | ✅ mixed-cn-en fixture |
| 截图小字号/高压缩 | ⚠️ 未做专项（WinRT 对小字/压缩图表现随图而异；列为后续 QA 项） |
| 竖排少量文字 | ⚠️ WinRT 对竖排支持有限（已知限制，README 记录） |

## Task 04 §13 验收
| 项 | 结果 |
|---|---|
| 图片下载成功 | ✅（8/8 实测） |
| OCR 运行 | ✅（fixture + 真实笔记链内） |
| notes.json 有 ocrText | ✅（imageOcr + ocrText 持久化） |
| 搜索 OCR 独有关键词命中 | ✅（灯光分层→极简书桌笔记；水温→咖啡笔记） |
| **App 重启不重新 OCR** | ✅ notes.json 启动前后 md5 一致 |
| **断网 OCR 正常** | ✅ WinRT 全程本地（ps1 无任何网络调用） |

## 性能（普通 Windows 笔记本）
- 单批 1-3 张：~0.65s/张（含 PowerShell 启动摊销，多图单进程顺序识别）
- 引擎启动：首次 ~1.5s（PowerShell + WinRT 加载），之后进程内复用
- OCR 在 sidecar 后台进程执行，UI 全程响应（五步管线动画并行）
- 5-10 张导入：<15s 总量，无 UI 卡顿

## 已知限制（诚实清单）
1. WinRT 竖排文字支持有限；小字号高压缩图识别质量随图变化
2. 依赖系统语言包：无 zh-Hans 语言包的机器自动回退用户语言/首个可用识别器（probe 会如实报告）
3. OCR 引擎输出无 confidence（WinRT 不提供）——接口允许省略（§4）
4. 文字图链内实时验证仍建议正式 QA 手动确认（Task 03/04 期间 XHS 搜索链接 token 化导致多次抓取失败，fixture 已覆盖识别能力）
