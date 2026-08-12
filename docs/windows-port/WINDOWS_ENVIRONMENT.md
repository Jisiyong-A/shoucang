# Windows 开发环境记录 — WINDOWS_ENVIRONMENT

> 检查日期：2026-08-12 ｜ 构建机（也是目标机）

## 系统
| 项 | 值 |
|---|---|
| Windows 版本 | Windows 10.0.26300.9032（build 26300） |
| CPU 架构 | x64 |
| 区域 | zh-CN（OCR 语言包 zh-Hans-CN 可用） |

## 工具链（开发机必备；最终安装包不要求终端用户具备）
| 工具 | 版本 | 备注 |
|---|---|---|
| Node | v24.14.1 | ⚠️ npm 全局 `omit=dev`：安装必须 `npm install --include=dev` |
| npm | 11.9.0 | 同上 |
| Rust | 1.95.0 (cargo 1.95.0) | |
| VS Build Tools | 2022 | Tauri 链接必需（VC Tools x64） |
| WebView2 Runtime | 151.0.4129.72 | 系统已装 |
| Tauri CLI | @tauri-apps/cli ^2.10.0 | |
| Chrome | 151.0.7922.109 | E2E 用（CDP） |
| Edge | 已安装（系统默认） | 插件 setup fallback |
| Git | 2.52.0.windows.1 | |
| NSIS | tauri-bundler 自动获取 | WiX/MSI 在本机 light.exe 失败 → 只用 NSIS |

## 网络
- GitHub / nodejs.org 直连不稳（curl 56）→ 统一走 Clash 代理 `http://127.0.0.1:7890`（git clone、curl、npm 需代理时）

## 已知环境陷阱
1. npm 全局 omit=dev → devDependencies 不装
2. `next dev`（Turbopack）本机崩溃（Failed to write app endpoint /page）；`next dev --webpack` 的 CSS `@import "tailwindcss"` 解析失败 → 开发预览用生产构建 + 静态服务器（`npm run build` + `python -m http.server dist`）
3. Chrome 151 stable 不再接受 `--load-extension`（需 --enable-unsafe-extension-debugging 亦无效）→ 扩展 E2E 用内容脚本注入法（scripts/e2e/xhs-import-e2e.py）
4. WinRT OCR 要求反斜杠路径；输出 CJK 字符间带空格（需规范化）
5. Windows 端口残留：`| head` 管道杀 bash 后 node 子进程成孤儿 → 用 netstat + taskkill 清理
