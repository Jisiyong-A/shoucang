# 看看收藏部署与打包现状

## 当前形态

- Tauri 桌面应用
- Next.js 首页整理台
- Node 本地 sidecar
- Chrome 单条导入扩展
- 本地 `notes.json`

## 打包命令

```bash
npm run tauri:build
```

## 浏览器扩展

开发阶段从 `browser-extension` 加载已解压扩展。正式分发前需要单独发布或打包扩展；Tauri 不会自动替用户安装 Chrome 扩展。

## 当前数据边界

- 扩展只读取拖动卡片已有的链接和标题，不具备 `tabs` 或 `cookies` 权限
- Sidecar 不带 Cookie 匿名解析单篇公开笔记页面，保存配图并调用 macOS Vision OCR
- App 不保存小红书 Cookie
- App 不调用收藏夹或评论接口，也不回退到 Chrome 登录态
- App 不做定时任务和后台抓取

## 当前风险

- 小红书页面 DOM 变化时，扩展选择器可能需要更新
- 匿名页面拒绝访问或结构变化时，单条导入会失败，但不会改用账号登录态
- 小红书公开页面状态结构变化时，正文和完整配图解析规则可能需要同步更新
