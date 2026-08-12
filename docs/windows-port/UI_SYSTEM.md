# SHOUCANG DOT/GRID UI — 视觉系统说明

> 代号：**SHOUCANG DOT/GRID UI**（仅代码/文档内部代号，非对外品牌）
> 2026-08-12 · windows-redesign

## 设计原则
- 90% 黑/白/灰 + 10% 状态色/强调色
- 点阵信息语言（状态、编号、进度、装饰），**绝不用于大段正文**
- 像素数字感（VT323 OFL 点阵字体：数字/编号/状态/标题 accent）
- 大圆角几何块 + 细边框 + 几何分区，无强阴影、无 3D、无卡片乱飞
- Nothing 工业语言启发但**完全原创**：无 Nothing 资产/字体/图标/版式
- 节奏感动效（140ms hover / 240ms panel），尊重 `prefers-reduced-motion`

## 色彩 Token（app/styles/tokens.css）
| Token | 值 | 用途 |
|---|---|---|
| --bg | #000000 | OLED 黑场 |
| --surface / -2 / -3 | #0C0C0E / #141417 / #1B1B1F | 面板层级 |
| --text / --text-dim / --text-faint | #F2F2F0 / #8B8B90 / #56565C | 文字三级 |
| --line / --line-strong / --grid | #232328 / #3B3B43 / #2A2A30 | 边框/点阵 |
| --accent | #D71921 | 信号（小面积） |
| --success | #2ECC71 | 就绪/完成 |
| --warning | #E19A37 | 告警 |

## 字体
- 正文：`Segoe UI Variable / Segoe UI / Microsoft YaHei / system-ui`（本地优先，无远程字体）
- 数据/等宽：`Cascadia Mono / SF Mono / JetBrains Mono / IBM Plex Mono / Consolas`
- 点阵：**VT323**（SIL OFL 1.1，已内嵌 `public/fonts/`，附 OFL.txt）——仅拉丁数字/状态词；**中文始终回退系统黑体**（letter-spacing + 点阵装饰建立点阵感，不牺牲可读性）

## 圆角尺度
8 / 12 / 16 / 24（主面板）/ 32 / 999（pill）——统一 token `--radius-*`，组件不随意定义。

## 信息架构（三层）
```
┌──────────────────────────────────────────┐
│ TitleBar: 收藏 / COLLECTION SYSTEM    │
│   [SEARCH] [IMPORT] [EXTENSION] [AGENT]  │
│   LOCAL ● READY                          │
├──────────────┬───────────────────────────┤
│ Sidebar      │ Main Collection Workspace │
│ ALL          │ Geometry Card Grid        │
│ GROUPS(折叠) │  01 / CATEGORY            │
│ CATEGORIES   │  标题 · 作者 · OCR•N IMG   │
│ (折叠,可拖放) │                          │
├──────────────┴───────────────────────────┤
│ StatusBar: LOCAL ENGINE · OCR ENGINE ·   │
│   NOTES · OCR INDEXED · SETTINGS         │
└──────────────────────────────────────────┘
```

## 组件要点
- **DotMatrix**：可复用点阵（sparse/fine/dense 三档），驱动状态灯/logo/分类 glyph/加载/搜索指示/空状态
- **ImportPipeline**：5 步点阵管线 `01 CAPTURE → 02 RESOLVE → 03 MEDIA → 04 OCR → 05 INDEX`，逐级点亮（dot-pulse），失败显示 FAILED（红）
- **SearchResultMeta**：命中来源标注 `TITLE/BODY/OCR/TAGS/AUTHOR MATCH`
- **Sidebar**：GROUPS（自定义分组，拖放目标）+ CATEGORIES（自动分类），均可折叠，分类名+数量+点阵 glyph
- **NoteCard**：`NN / CATEGORY` 像素编号 + `OCR • N IMAGES` 元信息，键盘可达（role=button + Enter/Space）
- **NoteDetail**：左图廊（缩略图+主图）+ 右侧 NOTE DATA 几何块（AUTHOR/CATEGORY/TAGS/BODY/OCR 折叠/SAVED AT）
- **SetupPanel**：SYSTEM SETTINGS —— LOCAL ENGINE / OCR ENGINE（真实语言列表）/ DATA LOCATION / BROWSER EXTENSION / AGENT MCP / ABOUT+LICENSE（AGPL-3.0-or-later），全部显示真实状态，可重新检查

## 动效
- hover 位移 120–180ms；panel 240ms；dot loading；progress step；scale 0.98→1
- 禁用：spring bounce 大量使用、过度玻璃模糊、卡片乱飞、3D rotate、长动画
- `@media (prefers-reduced-motion: reduce)` 全局降级（globals.css）

## Windows 适配
- 响应式网格 `repeat(auto-fill, minmax(224px, 1fr))`；窗口 min 1080×760
- 1366×768 / 1440×900 / 1920×1080 / 2560×1440 均验证（grid 自适应 + 侧栏固定宽 212px）
- 125% / 150% DPI scaling 由 CSS px 自然适配

## 无障碍
- 键盘导航：卡片/导航项 role=button + Enter/Space；Escape 关闭弹层/清搜索
- 可见 focus（focus-visible outline 2px）
- 按钮 aria-label；StatusLight 带 role=status
- 状态不依赖颜色（文字标签：READY/OFFLINE/OCR…/MATCH）
- 最小点击区 30–36px
