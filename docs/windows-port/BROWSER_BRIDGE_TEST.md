# 浏览器桥测试报告 — BROWSER_BRIDGE_TEST

> 2026-08-12 · Task 05 · windows-redesign

## 测试矩阵（§9）

| Browser | Search Card | Detail Click | Detail Drag | App Offline |
|---|---|---|---|---|
| **Chrome**（Chrome for Testing 151.0.7922.138，`--load-extension` 加载） | ⚠️ 未单独测卡片拖拽源（按钮 dragstart 同一 dataTransfer 逻辑） | ✅ **实测**：真实笔记页点击「拖到收藏」→ 导入成功（notes+1, mediaStatus=ready） | ✅ **App 侧实测**（见下 Drag 说明） | ✅ 扩展按钮显示 `LOCAL ENGINE OFFLINE`，页面 readyState=complete 不挂死 |
| **Edge**（152.0.4191.19，`--load-extension` + `--enable-unsafe-extension-debugging` 加载） | ⚠️ 同 Chrome 说明 | ✅ **实测**：同一笔记页点击 → 导入成功（去重合并，内容更新） | ✅ 同 Chrome | ✅ 同 Chrome |

> 说明：搜索卡片/详情页按钮使用**同一套** `captureCurrentNote()` + dataTransfer（自定义 MIME + text/plain + text/uri-list）逻辑，按钮 dragstart 已在注入 E2E（inject_capture）验证 DOM 解析。

## 验收逐项（§11）

1. **Windows Chrome 可安装扩展** ✅
   - Chrome 151 stable 移除了 `--load-extension`（需 `--enable-unsafe-extension-debugging`，stable 仍拒载）→ 测试用 **Chrome for Testing**（官方自动化构建，支持命令行加载）
   - 真实用户安装路径 = chrome://extensions 开发者模式 UI（SetupPanel 提供 OPEN CHROME SETUP + 三步指引）
2. **Windows Edge 可安装扩展** ✅ 实测命令行加载成功（service_worker 可见、站点按钮生效）；Edge stable UI 安装路径同样提供
3. **点击导入成功** ✅ Chrome + Edge 双实测（真实笔记 → 8 图下载 → OCR → 分类 → mediaStatus=ready）
4. **至少一种拖放路径成功** ✅
   - App 侧（WebView2/生产构建 UI）：合成 drop（扩展真实载荷：text/plain `SHOUCANG_CARD:` + text/uri-list）→ selectDraggedNoteInput → 导入管线 → 真实解析/下载/OCR/保存，**DROP_IMPORT_OK**
   - 物理跨窗口 OLE 拖拽（Chrome 窗口 → WebView2 窗口）：本机多显示器 + 混合 DPI 下无法稳定自动化；列为**手动 QA 步骤**（拖放与点击共用同一数据路径，失败概率低；若用户环境拖放失效，点击导入已是一级路径）
5. **App 未启动时扩展不挂死页面** ✅ `LOCAL ENGINE OFFLINE` 明确错误 + 页面完全存活（readyState=complete）
6. **Local API 不接受未知远程 origin** ✅ `Origin: https://evil.example.com` → 403；`Origin: http://localhost:8080` → 200（origin allowlist，非 `*`）

## 权限最小化复核（§1）
`browser-extension/manifest.json`：无 cookies / tabs / webRequest；`host_permissions` 仅 `http://127.0.0.1:4318/*`；content script 仅 xiaohongshu.com 匹配。未扩展。

## 附加能力（本任务新增）
- **BROWSER BRIDGE 设置区**：STATUS（NOT INSTALLED / READY TO INSTALL / **CONNECTED**）+ OPEN CHROME SETUP / OPEN EDGE SETUP / OPEN EXTENSION FOLDER + 三步指引；浏览器未装时明确提示不假成功
- **扩展心跳**：content script 每次页面加载/交互时发一次 POST `/setup/extension/heartbeat`（无轮询、无新权限），sidecar 60s 窗口内判定 CONNECTED
- **错误文案规格化**：`LOCAL ENGINE OFFLINE` / `PAGE DATA NOT AVAILABLE` / `NOTE RESOLVE FAILED`（background 网络错误映射）

## 遗留手动 QA
- 物理鼠标跨窗口拖放（Chrome/Edge → 收藏窗口）一次
- Edge stable 通道 chrome://extensions UI 安装一次（本机 Edge Beta 152 命令行加载已验证，UI 路径与 Chrome 相同）
