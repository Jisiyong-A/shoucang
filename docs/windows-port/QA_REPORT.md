# QA 验收报告 — QA_REPORT

> 2026-08-12 · Task 08 · windows-redesign · 测试硬件：Win11 build 26300 x64，16GB 级
> 普通笔记本（本机），Chrome for Testing 151 / Edge 152 / WebView2 151

## §1 自动测试（全绿）
| 门禁 | 结果 |
|---|---|
| npm test | ✅ 66 tests / 65 pass / 1 skip（macOS WebKit 专属）/ 0 fail |
| npm run lint | ✅ 0 error / 0 warning |
| npm run build | ✅ |
| npm run tauri:build | ✅ NSIS installer 产出 |

## §2 核心 E2E
| ID | 场景 | 结果 | 证据 |
|---|---|---|---|
| E2E-01 | 安装→启动→Local API READY | ✅ | 安装版 health ok + localOcr True（含干净环境） |
| E2E-02 | 浏览器桥（扩展→localhost→app） | ✅ | Chrome/Edge 双实测 + 心跳 CONNECTED |
| E2E-03 | 导入真实公开笔记（title/author/body/images/category/savedAt） | ✅ | 8 图下载、mediaStatus=ready、分类命中 |
| E2E-04 | OCR：imageOcr+ocrText+图内词搜索命中 | ✅ | 种子 ocrText 关键词搜索命中；fixture 实测识别（见 OCR_TEST_RESULTS） |
| E2E-05 | 重启数据仍在 | ✅ | notes.json 启动前后 md5 一致 + 重开可见 |
| E2E-06 | 删除：notes.json/media/UI 一致 | ✅ | 删除 API 清 notes 条目 + media 目录 + UI 刷新 |
| E2E-07 | MCP：search/read 成功 | ✅ | mcp-acceptance A–E 全 PASS + hermes mcp test |

## §3 断网
✅ 设计保证：除「新导入远程内容」外全部本地（sidecar 服务 /notes//media 纯磁盘；OCR 为 OS 内置本地引擎；MCP 直读文件）。离线状态截图 06-offline.png 验证 sidecar 离线时 UI 明确提示且不崩。

## §4 Local API 安全
| 项 | 结果 |
|---|---|
| 仅监听 127.0.0.1 | ✅（netstat 实测 127.0.0.1:4318） |
| origin allowlist | ✅（evil origin 403 / localhost 200） |
| 无通配 CORS | ✅（非 `*`） |

## §5/§6 大数据量与性能（合成 100/500/1000 笔记，无真实用户数据）
| 指标 | 100 | 500 | 1000 | 门槛 | 结果 |
|---|---|---|---|---|---|
| 首屏可交互 | 0.38s | 0.39s | 0.39s | <3s | ✅ |
| 卡片全量渲染 | ✅ | ✅ | ✅ | — | ✅ |
| 搜索出结果 | 4ms | 4ms | 4ms | <300ms | ✅ |
| 滚动（1000 卡到底） | — | — | 557ms 无冻结 | 无冻结 | ✅ |
| OCR 后台不阻塞 UI | ✅（sidecar 进程 + 管线动画） | | | ✅ | ✅ |

## §7 内存（实测快照）
| 进程 | 内存 |
|---|---|
| App (shoucang.exe) | ~27–41 MB |
| Node sidecar（含 1000 笔记加载） | ~40–76 MB |
| WebView2 全部子进程 | ~131 MB（预览 Chrome 实测；Tauri WebView2 同构） |
| OCR 进程 | 无常驻（PowerShell 每批调用即退，模型=OS 内置零常驻） |

结论：OCR 无常驻进程 → 无需 idle shutdown / lazy restart（§7 备注项不适用）。

## §8 DPI / §9 分辨率
- 150% DPI（force-device-scale-factor=1.5）：字体/卡片/标题栏/状态栏全部正常
  （截图 10-dpi150-1366x768.png，视觉核验无错位截断）✅
- 1366×768 / 1440×900 实测 ✅；1920×1080 / 2560×1440 由响应式 grid 保证（auto-fill minmax(224px)）
- 100% / 125% 由 CSS px 自然适配（无固定 px 布局）

## §10 UI 状态截图（docs/windows-port/screenshots/）
| 状态 | 文件 | 结果 |
|---|---|---|
| EMPTY | 05-empty.png | ✅ |
| NORMAL（5 卡） | 01-home.png | ✅ |
| NORMAL（1000 卡） | （perf 运行截图） | ✅ |
| SEARCH | 02-search.png | ✅ |
| NOTE DETAIL | 03-detail.png | ✅ |
| IMPORTING | 08-importing.png | ✅ |
| ERROR | 09-error.png | ✅ |
| LOCAL ENGINE DOWN | 06-offline.png | ✅ |
| AGENT CONNECTED | 07-agent-connected.png（HERMES CONNECTED + MANUAL CONFIG） | ✅ |
| OCR PROCESSING | 管线动画步骤含于 08-importing.png | ✅ |

## §11 错误注入
| 注入 | 结果 |
|---|---|
| 4318 被占用 | ✅ sidecar EADDRINUSE 明确日志 + listen 重试 + 退出（app 显示 OFFLINE） |
| OCR 脚本缺失 | ✅ localOcr=False + error 含具体文件不存在信息 |
| notes.json 损坏 | ✅ 返回空 + `[shoucang] notes.json 解析失败` 可诊断日志（新增） |
| media 无权限 | ⚠️ 未专项测试（P2；Windows ACL 下表现为 mediaStatus partial） |
| 浏览器未安装 | ✅ NOT INSTALLED + 明确手动指引，不假成功 |
| Agent CLI 不存在 | ✅ NOT FOUND（resolveExecutable null） |
| 断网 | ✅（见 §3） |
| 远程图片失败 | ✅ mediaStatus=partial + mediaError 计数 |

## §12 回归边界
✅ 无 Cookie 访问 / 无登录态 / 无批量抓取 / 无后台同步 / 无代理 / 无验证码绕过
（manifest 权限审计 + 代码路径审计 + 抓取流程一次一条手动触发）

## §13/§14 结论
| Severity | 数量 | 状态 |
|---|---|---|
| P0 | 0 | ✅ 清零 |
| P1 | 0 | ✅ 清零（本阶段修复 2 个 P1：干净环境 powershell ENOENT；notes.json 损坏静默） |
| P2 | 2（media 无权限专项测试缺失；OCR 小字/竖排已知限制） | 记录在案 |
| P3 | 0 | ✅ |

**QA 结论：PASS（P0/P1 清零）** — 见 Task 09 最终门禁。
