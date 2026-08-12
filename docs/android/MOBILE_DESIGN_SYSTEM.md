# MOBILE_DESIGN_SYSTEM · Dot Matrix + Rounded Geometry（Task 11）

Date: 2026-08-12
原则: 原创视觉语言（受 Nothing 工业设计启发，**不复制任何 Nothing 资产**）

## 1. 视觉原则（§1）

```text
dot matrix        — 点阵信息图形（状态、进度、空态）
pixel information — 数据优先的排版（大数字、等宽、信息密度高）
black/white/warm gray — 单色系（#000 / #FFF / #E5E2DC 暖灰）
rounded geometry  — 大圆角容器（24dp 卡片、16dp 按钮）
large data typography — 大字号数据（计数、指标）
minimal accent    — 仅信号色 #D71921（错误/警告），其余纯黑白灰
```

**禁止**：Nothing logo、Nothing OS icons、Nothing 专有字体（Ndot/NType）、官方 widget 布局、官方 assets。

## 2. 字体

- 主字体：系统默认（Roboto/Noto Sans CJK）——零许可风险
- 数据/点阵感：等宽 fallback（`ui-monospace` / Roboto Mono，系统自带）
- 点阵矩阵效果：用 CSS `letter-spacing` + 小圆点背景图案实现，不依赖专有点阵字体

## 3. 颜色 token

| Token | 值 | 用途 |
|---|---|---|
| bg/base | #000000 | OLED 纯黑底 |
| surface | #111111 | 卡片 |
| surface/raised | #1A1A1A | 浮层 |
| text/primary | #FFFFFF | 主文本 |
| text/secondary | #8A8A8A | 次要 |
| text/tertiary | #555555 | 占位 |
| line | #262626 | 分割线 |
| accent/signal | #D71921 | 仅错误/警告/重要信号 |
| accent/ok | #7CFC98 | 成功/就绪（低饱和绿，仅状态） |

## 4. 间距 / 圆角 / 动效（§13）

```text
spacing: 4/8/12/16/24/32
radius:  8 (chip) / 16 (button) / 24 (card) / 32 (sheet)
motion:  120–250ms, ease-out; dot-matrix loading 循环 800ms
reduce motion: 尊重系统 animator scale（0 → 无动画）
```

## 5. 点阵组件语言

- **点阵进度**：导入流程 01 RESOLVE ● / 02 MEDIA ● / 03 OCR ◌ / 04 TEXT ○ / 05 VISUAL ○
- **点阵空态**：
  ```text
  ∙ ∙ ∙
  ∙ ○ ∙
  ∙ ∙ ∙
  NO MEMORY YET
  SHARE SOMETHING HERE
  ```
- **点阵加载**：3×3 点阵脉冲循环
- 不用 AI 插画（§14）

## 6. 底部导航（§2，≤4 项）

```text
LIBRARY   SEARCH   SYSTEM
```
Search 是一级功能（§4）——中间位置，突出。

## 7. 搜索（§4-5，产品第一功能）

- 搜索框：`描述你记得的内容……` / `Describe what you remember...`（支持长自然语言）
- 结果默认 mixed：`BEST MATCHES`
- 结果卡：
  - ARTICLE：`ARTICLE` 徽标 + 标题 + 语义命中摘要 + category
  - IMAGE：`VISUAL MATCH` + thumbnail + 所属文章
- 命中理由标签：TITLE MATCH / SEMANTIC MATCH / OCR MATCH / VISUAL MATCH（不暴露 raw score，§6）
- 过滤：ALL / ARTICLE / IMAGE / OCR（§6，高级过滤 category/date/source 折叠）

## 8. 导入页（§7）

```text
● RECEIVED
SOURCE: 小红书/知乎/…
URL
[ SAVE ]
```
保存后显示点阵进度流（§5）。

## 9. Note 详情（§8）

纵向：Hero gallery → Title → Metadata → Body → OCR toggle → Related visual → Source URL

## 10. System 页（§9-10）

```text
LOCAL DATABASE    147 items / 52.6MB
OCR MODEL         RapidOCR v4 · INSTALLED
TEXT MODEL        bge-zh · INSTALLED
VISUAL MODEL      cn-clip · INSTALLED
INDEX STATUS      100%
STORAGE           使用 / 可用
ALL PROCESSING ON DEVICE
```
Model pack 管理：INSTALL / VERIFY / REPAIR / REMOVE（REMOVE 不删 notes/media）

## 11. Android 平台约束（§11）

system back / safe areas / gesture nav / keyboard / text scaling（100/130/150%）/ accessibility（touch target ≥48dp、contentDescription）/ dark mode（本设计即深色）/ rotation policy（portrait 优先）

## 12. 性能（§12）

图片 grid：lazy + thumbnail（不载原图）+ virtualization；dot-matrix 用 CSS（零资源）

## 13. 验收尺寸（§15）

360dp / 393dp / 412dp / tablet smoke——真机阶段执行；font scale 100/130/150%
