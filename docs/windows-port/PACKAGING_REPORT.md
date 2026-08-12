# Windows 打包报告 — PACKAGING_REPORT

> 2026-08-12 · Task 07 · windows-redesign

## 产物（§1/§12）
```
release/windows/ShouCang-Favorites-Windows-x64-0.1.0-beta.exe   25.1 MB (NSIS)
release/windows/SHA256SUMS.txt
SHA256: 3f512ed341da917738974da7b6250bb472946cb08be67b885d27340084ad4af6
```
- 发行格式：NSIS setup.exe（§1 首选；MSI 因本机 WiX light.exe 失败跳过——Tauri 默认
  双目标里 MSI 非必需，Beta 门槛只要求 setup.exe）
- 产物目录说明：规格写 `dist/windows/`，但 Next.js `output:'export'` 的 distDir 就是
  `dist/`（构建时整目录清理 + rmdir 锁冲突）→ 改用 `release/windows/`（记录偏差）

## 安装包内容（§2，7z 实测列出）
| 项 | 状态 |
|---|---|
| Tauri app (shoucang.exe 8.7MB) | ✅ |
| frontend dist（embedded） | ✅ |
| bundled Node runtime (node\node.exe v24.14.1) | ✅ |
| local-api scripts + lib/ + ocr/ + platform/（19 资源，bundle-completeness 守卫） | ✅ |
| MCP server (shoucang-mcp.mjs) | ✅ |
| OCR runtime（windows-ocr.ps1；引擎=OS 内置 Windows.Media.Ocr，无模型文件） | ✅ |
| browser-extension/（manifest+content+background+page-data） | ✅ |
| icons（tauri icon 全套含 .ico） | ✅ |
| license（AGPL-3.0-or-later；`bundle.licenseFile` 编译进 NSIS 许可页） | ✅ |
| attribution（OCR=OS 组件无再分发；VT323 OFL 已在 public/fonts/OFL.txt；无第三方模型） | ✅ |

## WebView2（§3）
- 目标环境 Win11 已内置；Tauri NSIS 默认 webviewInstallMode=downloadBootstrapper
  （缺失时明确下载 WebView2 引导器，非静默未知操作）
- 本机 WebView2 151 实测可用

## 图标（§4）✅ 原创点阵 K 图标（黑/白底、圆角几何），无 Nothing/Apple/小红书商标
## 名称（§5）✅ 开发阶段保留「收藏」，未擅自改名
## 路径（§6）✅ 安装=%LOCALAPPDATA%\收藏（Tauri NSIS 默认）；用户数据
  =%LOCALAPPDATA%\com.patrick.shoucang（绝不写安装目录）

## 升级安全（§7）✅ 数据在 LocalAppData 独立目录，重装/覆盖安装不触碰
（实测静默重装后 notes.json/media 原样）
## 卸载（§8）✅ uninstall.exe /S 移除应用，用户数据保留（实测目录删除、数据目录健在）
## 日志（§9）✅ local-api.stdout.log / local-api.stderr.log / spawn.log（Rust 启动诊断）
在数据目录；无 Cookie/token 记录
## Defender/SmartScreen（§10）⚠️ Beta 未签名（记录在案）；未用任何规避 packer；
正式发布应 code signing

## CI（§11）✅ .github/workflows/windows-build.yml（checkout/setup node+rust/
npm ci/test/lint/build/tauri build/bundle 校验/artifact upload，rust-cache 缓存）

## 干净环境冒烟（§13/§14）— 本机最小 PATH 模拟（仅 System32+Windows）
| 步骤 | 结果 |
|---|---|
| 安装 | ✅ |
| 启动（无 Node/Python/Rust in PATH） | ✅（bundled node 自动拉起 sidecar） |
| Local API health | ✅ ok + localOcr=True + languages 完整 |
| OCR（probe 实测） | ✅（修复了 P1：干净 PATH 下 powershell.exe ENOENT → 绝对路径回退） |
| MCP（bundled node + 安装版 server，OCR 词搜索） | ✅ PASS |
| 卸载 | ✅ 应用移除、用户数据保留 |

## 本阶段修复的 P1
`scripts/ocr/windows-local.mjs`：Win11 无 System32\powershell.exe shim（真身在
WindowsPowerShell\v1.0）→ `resolvePowerShellExecutable()` 优先绝对路径、PATH 名兜底。
干净环境（真实用户环境）下 OCR 曾完全不可用（ENOENT）——§13 测试直接抓获。
