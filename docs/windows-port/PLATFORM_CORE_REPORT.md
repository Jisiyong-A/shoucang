# Windows 平台核心报告 — PLATFORM_CORE_REPORT

> 2026-08-12 ｜ 分支 windows-redesign ｜ Task 02 输出

## 1. 平台抽象（scripts/platform/）
| 文件 | 职责 |
|---|---|
| `common.mjs` | 纯函数：数据目录（win32/darwin/posix + LOCAL_APP_DATA_DIR 覆盖 + legacy 迁移路径）、平台判定 |
| `windows.mjs` | %LOCALAPPDATA% 数据目录、Agent 可执行发现（已知路径 → where.exe）、explorer 打开文件夹、Chrome/Edge 探测与打开 |
| `macos.mjs` | Application Support 数据目录、Homebrew/`command -v` 发现、`open` 打开 |
| `index.mjs` | 统一 facade（dataDirectory / resolveAgentExecutable / openFolder / openBrowserUrl / 平台名） |

业务代码（local-api / shoucang-mcp）已全部迁移到 facade；`process.platform` 分支仅剩数据常量与上报字段（3 处，有注释）。

## 2. 数据目录
- 发布版数据：Tauri `app_local_data_dir()` → `%LOCALAPPDATA%\com.patrick.shoucang\`（Rust 传入 LOCAL_APP_DATA_DIR）
- 旧 `~/.shoucang` 仅作兼容迁移源（读合并，不写入）
- 结构：notes.json / media/ / local-api.{stdout,stderr,spawn}.log

## 3. Node runtime（self-contained）
- `src-tauri/resources/node/node.exe`（v24.14.1 win-x64）随包分发，Rust 经 `BaseDirectory::Resource` 解析
- 发布版优先 bundled runtime；dev 模式回退 PATH `node`；`LOCAL_API_NODE_BIN` 可强制覆盖
- 已实测：卸载系统 Node 依赖场景（中性 cwd 启动安装版，sidecar 用 bundled node 正常）

## 4. Rust 启动层（main.rs）
- dev/release 分开解析（cwd 候选 → Resource；资源路径存在则优先 bundled）
- Windows 无 Homebrew 路径
- stdout/stderr 写数据目录日志；`local-api.spawn.log` 记录每次实际 spawn 的 node/script/cwd（诊断）
- sidecar 启动失败：stderr + 日志目录落盘（release GUI 无 stderr 可见性补偿）
- `wait_for_local_api`：spawn 后 ≤10s 探测 /health，输出 ready / early-exit（含 EADDRINUSE 提示）
- 退出杀子进程（ExitRequested/Exit）
- **修复：`\\?\` verbatim 路径规范化**（Tauri path resolver 返回 `\\?\C:\...`，Node 24 CJS loader 无法加载 → EISDIR 'C:'；新增 `normalize_win_path` 统一去前缀，含 UNC 分支）

## 5. Health bootstrap
- 前端：`LOCAL ENGINE · STARTING` → READY（LED 绿）→ 离线（LED 红闪），首次探测标记 `healthChecked`
- sidecar 侧：`listenWithRetry`（EADDRINUSE 最多重试 10 次 ×1s，容忍强杀残留 socket）
- /health 暴露 platform / localOcr / ocr{engine,available,languages,error}

## 6. Tauri 配置
- 已去除 macOSPrivateApi / trafficLightPosition / macOS titlebar 假设
- 窗口：resizable + minWidth 1080 + minHeight 760 + maximized；原生窗口控制

## 7. 图标
- icon.ico（32/64/128/256 由 `tauri icon` 从 1024px 源图生成）；临时原创图标，后续可替换；无 Nothing 品牌资产

## 8. 测试（新增 +11）
| 文件 | 覆盖 |
|---|---|
| `scripts/platform/platform-path.test.mjs`（+10） | win32/darwin/posix 数据目录、LOCAL_APP_DATA_DIR 覆盖、legacy 路径、Agent 候选形状、浏览器探测契约 |
| `scripts/lib/ocr-adapter.test.mjs`（+1） | probeLocalOcr win32 引擎形状（真实探测，win32 门控） |
| 生命周期 | 实测：启动 App → 4318 listening → 关闭 → 4318 free（安装版 + dev 版均验证） |

## 9. 验收命令
```
npm test      → 60 tests / 59 pass / 1 skip(macOS) / 0 fail
npm run lint  → clean
npm run build → pass
tauri build   → NSIS setup.exe 生成
Invoke-RestMethod http://127.0.0.1:4318/health → ok, localOcr true, engine windows
```

## 10. 完成定义
App 正常启动 ✅ / Local API 正常 ✅ / 本地笔记读写 ✅（notes.json atomic write）/ 图片下载 ✅（E2E 8/8）/ 关闭无孤儿进程 ✅（安装版退出+卸载验证）/ OCR 为空时的健康路径 ✅（engine null 时 UI 显示离线，不崩溃）

## 关键坑（记录）
1. **`\\?\` 前缀**：Tauri `app.path().resolve()` 在 Windows 返回 verbatim path，Node 24 无法将其作为主模块加载（EISDIR 'C:'）。必须 `normalize_win_path` 后再传子进程。
2. **bundle 缺文件静默失败**：`ocr-adapter.mjs` 一度未加入 resources，安装版 sidecar 启动即 ERR_MODULE_NOT_FOUND；从仓库 cwd 启动会掩盖此问题（cwd 候选命中 dev 脚本）。新增 `scripts/e2e/bundle-completeness.py` 守卫（15 个脚本资源全依赖覆盖）。
3. **taskkill /F 应用不会触发 Tauri 退出清理** → sidecar 成孤儿占 4318 → 下次启动 EADDRINUSE。双保险：listenWithRetry + 测试时成对杀进程。
