# UI_SCREEN_MAP · 移动端屏幕地图（Task 11）

Date: 2026-08-12
状态: 设计定义（实现待真机阶段；实现层 = React WebView 静态导出，沿用桌面 Next 技术栈）

## 导航结构

```text
┌─────────────────────────────┐
│  LIBRARY    SEARCH    SYSTEM │  底部导航（3 项）
└─────────────────────────────┘
```

## S1 · LIBRARY（首页）

```text
KAN/KAN
LOCAL ARCHIVE

147 ITEMS · 382 IMAGES · 100% LOCAL

[ 描述你记得的内容…… ]

RECENT
────────────────
[ARTICLE] 标题…            ← note 卡（缩略图 + 标题 + category）
[ARTICLE] 标题…
[IMAGE]   …                ← 图片网格（lazy thumbnails）
```

## S2 · SEARCH（核心页）

```text
[ 描述你记得的内容…… ]          ← 长自然语言输入
ALL · ARTICLE · IMAGE · OCR    ← 过滤 chips

BEST MATCHES
────────────────
ARTICLE
SANAA 美术馆                    ← 标题
环形玻璃幕墙让公园与室内连成一片… ← 语义命中摘要
建筑 · SEMANTIC MATCH
────────────────
VISUAL MATCH
[thumb] 白色曲面建筑            ← 图片结果 → 点击回 note
────────────────
ARTICLE
潮汕牛肉丸
手打牛肉丸弹牙
美食 · OCR MATCH
```

调试模式（release 隐藏）：
```text
fts rank=3 · text=0.82 · image=— · fusion rank=1 · chunk="环形玻璃…"
```

## S3 · IMPORT（Sharesheet 进入）

```text
● RECEIVED

SOURCE  小红书
URL     xiaohongshu.com/explore/…

[ SAVE ]

── 保存后 ──
01 RESOLVE ●
02 MEDIA   ●
03 OCR     ◌
04 TEXT    ○
05 VISUAL  ○
```

## S4 · NOTE DETAIL

```text
[Hero gallery 滑动]
SANAA 美术馆
建筑 · 作者A · 2026-08-12

正文…
OCR TOGGLE [开/关]           ← 显示 ocr_text
RELATED VISUAL [缩略图行]
SOURCE URL ↗
```

## S5 · SYSTEM

```text
LOCAL DATABASE     147 items
OCR MODEL          RapidOCR v4 · INSTALLED
TEXT MODEL         bge-zh-int8 · INSTALLED
VISUAL MODEL       cn-clip · INSTALLED
INDEX STATUS       100%
STORAGE            52.6MB / 可用

ALL PROCESSING ON DEVICE

SEMANTIC MODEL PACK  214MB
[VERIFY] [REPAIR] [REMOVE]
```

## S6 · 空状态

```text
∙ ∙ ∙
∙ ○ ∙
∙ ∙ ∙

NO MEMORY YET
SHARE SOMETHING HERE
```

## S7 · 搜索无结果

```text
没有找到足够相关的收藏
```
（relevance threshold 生效，不随机返回）

## 实现映射

| 屏幕 | 组件（React，桌面可复用） |
|---|---|
| S1 | 桌面 DeskView 适配 + BootstrapStatus 复用 |
| S2 | 搜索结果卡（新组件：ARTICLE/IMAGE 卡 + MATCH 标签） |
| S3 | ImportSheet（新组件，invoke → ingest_jobs 状态轮询） |
| S4 | NoteDetail 移动布局（桌面笔记视图改造） |
| S5 | SystemPage（新组件：model_registry + settings 读取） |
| 公共 | 点阵组件库（Dots：progress/loading/empty） |

screenshots/：真机/模拟器阶段产出（当前无设备，目录预留）。
