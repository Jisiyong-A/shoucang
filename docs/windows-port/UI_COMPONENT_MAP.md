# UI 组件地图 — SHOUCANG DOT/GRID

> 2026-08-12 · DeskView.tsx 1765 行 → 21 个组件文件（≤300 行/文件）

## 目录结构
```
app/components/
├── DeskView.tsx           编排器：状态/副作用/三层壳装配（~600 行）
├── DeskView.types.ts      ImportPhase / SetupPanel 共享类型
├── EmptyState.tsx         空状态（点阵 glyph + NO ITEMS + DRAG A NOTE HERE）
├── ui/                    设计系统原语（无业务逻辑）
│   ├── DotMatrix.tsx      DotMatrix / Dot / DotRow
│   ├── Panel.tsx          Panel / MatrixLabel / StatCell
│   ├── Badge.tsx          Badge（default/signal/error/ok/warning）
│   ├── Button.tsx         Button（ghost/primary/danger，sm/md）
│   ├── StatusLight.tsx    StatusLight（ok/error/warn/idle + blink）
│   └── index.ts           统一出口
├── shell/                 应用壳
│   ├── TitleBar.tsx       品牌 + 搜索 + IMPORT/EXTENSION/AGENT + LOCAL 状态
│   ├── Sidebar.tsx        ALL / GROUPS（拖放目标、重命名）/ CATEGORIES（折叠）
│   └── StatusBar.tsx      LOCAL ENGINE / OCR ENGINE / NOTES / SETTINGS
├── notes/                 笔记域
│   ├── NoteGrid.tsx       响应式网格 + 拖拽接线
│   ├── NoteCard.tsx       NN/CATEGORY 编号 + OCR•N IMAGES + 命中来源
│   ├── NoteDetail.tsx     详情（图廊 + NOTE DATA + 删除确认）
│   └── NoteGallery.tsx    图廊（缩略图栏 + 主图）
├── search/                搜索域
│   ├── SearchBar.tsx      核心搜索框（SEARCHING LOCAL ARCHIVE…）
│   └── SearchResultMeta.tsx findMatchSources + TITLE/BODY/OCR/TAGS/AUTHOR MATCH
├── import/                导入域
│   ├── ImportDropzone.tsx 全屏拖放区 + 反馈（含 5 步管线）
│   ├── ImportPipeline.tsx 01 CAPTURE→05 INDEX 点阵逐步点亮
│   └── ImportPipeline.types.ts
└── setup/                 设置域
    ├── SetupPanel.tsx     SYSTEM SETTINGS（ENGINE/OCR/DATA/EXTENSION/AGENT/ABOUT/LICENSE）
    └── AgentPanel.tsx     Codex / Claude Code 连接
```

## 数据流
```
page.tsx ──轮询 GET /notes──▶ store (useReducer)
DeskView ──▶ filterNotesByQuery ──▶ NoteGrid
         ──▶ findMatchSources(搜索时) ──▶ NoteCard 命中标签
         ──▶ runImport ──▶ ImportDropzone (pipeline 状态机)
         ──▶ getLocalServiceHealth ──▶ TitleBar/StatusBar/SetupPanel
```

## 状态归属（全部在 DeskView，子组件纯展示）
| 状态 | 位置 |
|---|---|
| notes / loading / error | store（AppContext） |
| deskState（分组/映射）/ activeGroup / activeCategory | DeskView |
| expanded / deletingNoteId | DeskView |
| serviceHealth / healthChecked | DeskView（2s 轮询 + setup 时刷新） |
| importFeedback（phase + step） | DeskView（runImport 驱动） |
| searchQuery / matchSources | DeskView |
| setupInfo / connectedClients / connectingClient | DeskView |

## 截图（docs/windows-port/screenshots/）
| 文件 | 状态 |
|---|---|
| 01-home.png | 首页：5 卡网格、01–05 编号、OCR 标记、状态栏 READY |
| 02-search.png | 搜索「咖啡」：SEARCHING… + TITLE/AUTHOR MATCH |
| 03-detail.png | 详情：图廊 + NOTE DATA + OCR 折叠 |
| 04-setup.png | SYSTEM SETTINGS 全区块 |
| 05-empty.png | 空库：NO ITEMS + DRAG A NOTE HERE |
| 06-offline.png | sidecar 离线：LOCAL ENGINE DOWN |
