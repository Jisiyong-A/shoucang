# PRIVACY_AUDIT · Android 隐私与安全审计（Task 13）

Date: 2026-08-12
范围: 当前 Android 构建（arm64-v8a debug/release）

## 1. 权限清单（manifest 实测）

| 权限 | 是否申请 | 说明 |
|---|---|---|
| INTERNET | ✅ | 仅用于：用户主动导入公开内容、Model Pack 下载 |
| READ_EXTERNAL_STORAGE / WRITE_* | ❌ | 无——数据全在 filesDir（app-scoped） |
| READ_ALL_FILES / MANAGE_EXTERNAL_STORAGE | ❌ | **绝不申请**（Task 13 §5 禁止项） |
| CAMERA / LOCATION / CONTACTS | ❌ | 无 |
| RECEIVE_BOOT_COMPLETED | ❌ | 当前无后台自启（WorkManager 若引入另评） |

图片接收：ACTION_SEND 走 **share URI grant**（无需存储权限），拷贝到 filesDir 后即释放。

## 2. 网络策略

- **Cleartext**：release `usesCleartextTraffic=false`（manifestPlaceholders 控制，build.gradle.kts 已验证）；debug 允许本地调试
- Model Pack 下载：HTTPS only + SHA-256 校验（见 MODEL_LICENSES.md）
- 不做：未验证重定向、任意图片 host 白名单外加载（导入内容按来源域名白名单处理，Task 04 实现）

## 3. 离线保证

| 操作 | 网络请求 |
|---|---|
| 语义搜索（query → vector → 检索） | **0 请求**（全部本地：onnxruntime + SQLite） |
| OCR | **0 请求** |
| 导入已保存 note 后的浏览/分类 | 0 请求 |

> 验收方法（Task 13 §9）：抓包工具（mitmproxy/PCAP）或离线飞行模式实测——真机验收阶段执行并记录。

## 4. 日志纪律

**不得记录**：
- token / cookies（分享链接中的 token 参数在解析后即丢弃，不进日志）
- 与用户无关的个人 URL
- 完整 OCR 内容（除非 debug 显式开启；release 关闭）

已实现：local-api 日志仅记录启动路径/端口（desktop 侧），Android 侧无 sidecar 日志。

## 5. 模型与数据校验

- 模型：SHA-256 启动前校验（model_registry.sha256）；失败 → 拒绝加载 + REPAIR 提示
- 数据：SQLite WAL + integrity_check 探针（storage crate 已实现）

## 6. 发布检查单（Beta 前）

- [ ] 真机离线验收：搜索/OCR 零网络请求（抓包记录）
- [ ] Model Pack 端到端：下载 → checksum → 安装 → 离线可用 → REMOVE 后数据保留
- [ ] release APK 签名（当前 debug keystore；发布需正式 keystore）
- [ ] THIRD_PARTY_NOTICES.md 生成（npm/rust license 工具）
- [ ] AGPL 合规确认（原仓库 license 核实）
- [ ] 字体/图标原创性核对（Task 11 视觉资产）
