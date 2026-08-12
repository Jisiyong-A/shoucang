# 基线测试结果 — BASELINE_TEST_RESULTS

> 2026-08-12 ｜ 分支 windows-redesign ｜ 上游 main @ 2026-08-12（含 1 处基线修复，见下）

## 门禁结果
| 命令 | 结果 | 说明 |
|---|---|---|
| `npm install --include=dev` | ✅ | 本机 npm 全局 omit=dev，必须显式 include |
| `npm test` | ✅ 41 pass / 1 skip / 0 fail | skip = macOS 专属 WebKit 缓存恢复 |
| `npm run lint` | ✅ | |
| `npm run build` | ✅ | Next 16 静态导出 |
| `cargo check` | ✅ | Windows target，含 icon.ico 资源 |
| `npm run tauri:dev` | ⚠️ 见下 | dev 服务器问题，非产品代码问题 |

## 基线修复记录
1. **eslint 缺失**：npm 全局 `omit=dev` 导致 devDependencies 未装 → `npm install --include=dev`（+339 包）。
2. **cache-cover-recovery 测试失败**：模块 `process.platform !== 'darwin'` 设计性守卫，Windows 返回 0（WebKit 缓存是 macOS 概念）→ 测试标记 `{ skip: !isDarwin }`，保留 darwin CI 覆盖；不伪造成功。

## tauri:dev 阻塞分类（Windows 平台阻塞）
`npm run tauri:dev` 链：`desktop:preview` → `next dev -p 1420`（Turbopack）→ **本机崩溃**（`Turbopack Error: Failed to write app endpoint /page`，panic 日志见 %TEMP%\next-panic-*.log）。另验证 `next dev --webpack` 无法解析 `@import "tailwindcss"`（PostCSS 未生效，仓库既有问题）。

**结论**：这是**开发模式（dev server）阻塞**，不是运行时/打包阻塞——`npm run build` + Tauri 静态资源路径完全正常（后续阶段已用 `tauri build` 产出并实测安装链）。修复选项（不在本阶段范围）：升级/降级 Next dev 工具链、改用静态服务器 dev 流、或仅以 `tauri build` 为开发验证路径。

## 结论
```text
BASELINE_STATUS=PARTIAL
```
- Windows 平台阻塞：仅 `tauri:dev`（Turbopack dev server 崩溃 + webpack-dev CSS 解析），影响开发迭代节奏；生产构建/打包/运行不受影响。
- 安全边界冻结 8 项 + 禁止清单 7 项已核对（见 ARCHITECTURE_BASELINE.md）。
- AGPL-3.0-or-later LICENSE 保留，未改动许可。
