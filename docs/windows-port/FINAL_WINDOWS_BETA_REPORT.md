# Windows Beta 最终发布报告 — FINAL_WINDOWS_BETA_REPORT

```text
Version:        0.1.0-beta
Commit:         2e6b5ba (windows-redesign; 自基线 6c21a5e 起 14 个任务提交)
Build date:     2026-08-12
Windows:        Windows 11 build 26300 (x64, zh-CN)
Installer:      release/windows/ShouCang-Favorites-Windows-x64-0.1.0-beta.exe (25.1 MB, NSIS)
SHA256:         3aeec137b6509fe55cddac8133346412c7149428609299fec2dd07d8a6521615
OCR:            Windows.Media.Ocr (zh-Hans-CN / en-GB / zh-Hant-TW 实测)
Known issues:   见 README「已知问题」+ 各阶段报告
```

## 门禁清单（Task 09 A–J 全量核对）

### A. Build ✅
npm test 66/65+1skip ✅ · lint 0/0 ✅ · build ✅ · tauri:build ✅ ·
setup.exe ✅ · SHA256SUMS.txt ✅

### B. Runtime ✅
无系统 Node 启动 ✅（bundled node 实测）· 无 Python OCR ✅（OS 内置 +
powershell 绝对路径回退）· 无 Rust ✅ · WebView2 151 ✅ ·
4318 ✅ · **App 退出无 orphan sidecar ✅（实测关闭后端口释放）**

### C. Data ✅
LocalAppData ✅ · notes.json ✅ · media ✅ · 升级不丢数据 ✅（重装实测）·
卸载默认不删用户资料 ✅

### D. Import ✅
Chrome setup ✅（CFT 实测 + UI 指引）· Edge setup ✅（Edge 152 实测）·
点击导入 ✅ 双浏览器 · 拖放 ≥1 链路 ✅（生产 UI + 真实载荷全链路）·
匿名 resolver ✅（credentials:omit 实测）· 图片本地保存 ✅（8/8）·
无 Cookie ✅（fetch 审计 + 扩展无 cookies 权限）

### E. OCR ✅
本地 ✅ · 中文 ✅ · 英文 ✅ · 无云 ✅ · 无首次强制联网 ✅ ·
OCR 进搜索 ✅ · 单图失败不丢笔记 ✅（partial 降级）· 模型许可完整 ✅

### F. UI ✅
非 macOS UI ✅ · 无 traffic lights ✅ · Dot/Matrix 一致 ✅ ·
圆角几何一致 ✅ · 原创 ✅ · 无 Nothing 资产 ✅ · 搜索明显 ✅ ·
导入 pipeline ✅ · Settings 完整 ✅（SYSTEM SETTINGS 全区块）·
125%/150% DPI ✅（1.5x 实测截图）· 键盘 focus ✅ · reduced motion ✅

### G. MCP/Agent ✅
Hermes 连接 ✅（hermes mcp add + CONNECTED 实测探测 + 配置备份）·
Codex/Claude 可连接 ✅（CLI 检测 + 注册路径）· 读正确数据目录 ✅
（LOCAL_APP_DATA_DIR 显式）· OCR 独有词可被 MCP 搜索 ✅（acceptance C）·
默认只读 ✅（2 工具无写）

### H. Security/Privacy ✅
localhost only ✅ · origin allowlist ✅ · 无 Cookie ✅ · 无 token ✅ ·
无自动批量抓取 ✅ · 无验证码绕过 ✅ · 无代理池 ✅ · 日志无敏感数据 ✅

### I. License ✅
AGPL-3.0-or-later ✅（bundle.licenseFile 编译进安装器）· OCR engine
= OS 组件（无再分发）✅ · 无 OCR 模型文件 ✅ · VT323 OFL.txt ✅ ·
无第三方 notice 缺口 ✅

### J. Documentation ✅
Windows 安装 ✅（README）· 扩展安装 ✅ · OCR ✅ · 数据位置 ✅ ·
MCP ✅ · 卸载 ✅ · 已知问题 ✅

## 结论

所有 P0 / P1 问题清零（QA_REPORT.md 逐项证据；本流程修复的 P1：
干净 PATH 下 OCR ENOENT、notes.json 损坏静默、`\\?\` 路径启动失败、
bundle 缺 ocr-adapter）。

```text
WINDOWS_BETA_READY=true
```
