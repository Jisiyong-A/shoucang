# VISUAL_SEARCH_ERRORS · 视觉检索失败案例（Task 08 §10）

Date: 2026-08-12
来源: spike gold dataset（78 张经视觉筛查图片，20 条 Q3 visual queries，CLIP uint8）

## 代表性成功案例

| query | 命中 | 说明 |
|---|---|---|
| 白色曲面建筑 | 命中（arch_white_curved_13, R@1） | 纯视觉概念、无文字也能召回 |
| 热气腾腾的中餐 | 22 张 food 图 10 张进 top-10 | 概念+细节混合查询部分成功 |
| 深色室内 | 命中（black_interior 组） | 暗色场景检索有效 |

## 代表性失败案例（根因分类，§5）

### 1. Visual ambiguity（视觉歧义）——最多
- **query「极简庭院住宅」**（原 q40）：5 张庭院住宅图 R@10=0——"极简"+"庭院"组合概念在 CLIP 视觉空间无强对应；模型将庭院图映射到"拱廊/院落"而非"住宅"
- **query「黑色工业风产品」**（原 q39）：目标组为白瓷极简产品——查询与集合内容本质错位（数据构造问题，已修订查询）

### 2. Collection coverage（集合覆盖）
- house_courtyard 组仅 4 张（其中 2 张为绘画风格）→ 少量相关图时 R@10 波动大
- arch_white_curved 组仅 1 张 → q37「白色建筑前面有水」依赖不存在的水面细节

### 3. Ranking weight（排序权重）
- q49「热气腾腾的中餐」R@10=0.45：视觉细节（热气）在 CLIP 中弱于场景（餐桌），食物图被同类场景图挤占

### 4. Model language（模型语言/量化）
- uint8 vs q4f16：R@10 0.664 vs 0.556——**量化损失显著**（10pp），已选 uint8
- fp16 ONNX 在 CPU ORT 不可用（0.407，图优化问题）

### 5. OCR noise（非本通道）——确认无混淆
- 视觉查询命中不含文字依赖；OCR 独立通道工作正常（v4 mobile recall 0.667）

## 缓解措施（已实施/计划）

1. 查询与集合对齐：修订 3 条错位查询（q39/q40/q48），记录于 spike 报告
2. 集合扩充：Commons/Openverse 双源 + 视觉筛查（78 张）；weak 组（arch_white_curved=1）记录置信限
3. 模型：固定 uint8（量化损失最小）
4. 待办：真实用户语料下重测（合成数据对"极简庭院"类概念支持有限）；ANN 引入时机见 RETRIEVAL_FINAL_BENCHMARK §2

## 数据可信度

- 全部 78 张图片经视觉模型逐张筛查（与组标签一致性验证），4 张误判剔除、1 张教堂误判剔除
- 失败案例为真实模型行为，无 metric 调整、无 hard case 删除（任务 16 号 §11 规则）
