# 看看收藏（当前执行文档）

## 产品边界

当前只维护免费本地版，只保留首页卡片分组。

明确不在当前实现中的内容：

- 知识库、知识图谱和流墙
- 收藏夹批量同步
- `safe-xhs` 或其他自动抓取器
- 小红书登录态和账号切换
- AI 聊天、远程模型配置和聚合知识库

## 当前调用链

1. 用户从小红书搜索页拖动一条笔记卡片
2. `browser-extension/content.js` 只把卡片已有的链接和标题写入拖拽载荷
3. `POST /notes/import` 调用无 Cookie 的本地匿名解析器读取这一条公开笔记页面
4. Sidecar 把配图保存到本地并调用 macOS Vision OCR
5. 标题、正文与图片文字参与本地分类
6. `app/components/DeskView.tsx` 把新笔记放入“新进笔记”，保留原有卡片与分组动效

扩展没有 `tabs` 或 `cookies` 权限，不能后台打开登录页面或读取账号凭证。匿名解析器显式使用 `credentials: omit`，失败时不会回退到登录浏览器。这条链路只处理用户拖入的单条笔记，不访问收藏夹。

## 主要文件

- `app/components/DeskView.tsx`：首页、卡片分组、整页拖入反馈
- `app/lib/xhs-client.ts`：前端访问本地服务
- `app/lib/desk-workspace.mjs`：分组状态
- `scripts/local-api.mjs`：本地存储 API
- `scripts/lib/anonymous-note-resolver.mjs`：不带账号凭证的单条公开页面解析
- `scripts/lib/note-import.mjs`：拖拽载荷校验、标准化和去重
- `scripts/lib/media-import.mjs`：配图本地化与本地 OCR
- `browser-extension/`：卡片拖拽与当前详情页的本地读取

## 验证命令

```bash
npm test
npm run lint
npm run build
```

## 接口

- `GET /health`
- `GET /notes`
- `POST /notes/import`
- `GET /media/:noteId/:file`
