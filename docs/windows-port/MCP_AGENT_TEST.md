# MCP / Agent 测试报告 — MCP_AGENT_TEST

> 2026-08-12 · Task 06 · windows-redesign

## 验收（§8）— 实际 MCP client（node JSONL client + hermes CLI）
| 测试 | 场景 | 结果 |
|---|---|---|
| A | 搜索只存在于**标题**的词（`鎏金独木舟`） | ✅ PASS |
| B | 搜索只存在于**正文**的词（`水磨石`） | ✅ PASS |
| C | 搜索只存在于**OCR** 的词（`苔藓微景观`） | ✅ PASS（返回正确笔记 id） |
| D | `read_saved_note` 按 id 读取完整内容 | ✅ PASS（正文+分类+OCR） |
| E | **App/sidecar 关闭后** MCP 仍可读（文件直读设计） | ✅ PASS |
| 只读审计 | tools/list = search_saved_notes / read_saved_note 仅两个；无 delete/write/create/import | ✅ 无写能力 |

`hermes mcp test shoucang-notes`：✅ 握手通过、2 工具可见（真实 Hermes CLI）。

## Hermes 集成（§3/§7）
- 注册方式：`hermes mcp add shoucang-notes --command <node> --env LOCAL_APP_DATA_DIR=<dataDir> --args <shoucang-mcp.mjs>`（CLI 官方方式，非手改配置）
- **配置备份**：`hermes mcp add` 前自动备份 `%LOCALAPPDATA%\hermes\**\config.{yaml,yml,json}` → `.shoucang-backup-<ts>`（§3 备份要求）
- **不覆盖其他 MCP**：只增删 shoucang-notes 条目（验证 excel 等既有 server 不受影响）
- 数据目录显式传 `LOCAL_APP_DATA_DIR`（§5），与桌面 App 同文件

## Node runtime（§4）
- 注册命令 = **应用自己的 runtime**：`process.execPath`（安装版 = bundled node.exe）+ 打包的 `shoucang-mcp.mjs`（Resource 解析）
- dev 模式允许系统 node（当前本机注册即 dev 形态，已注明）

## 检测（§2）
- `where.exe hermes / codex / claude` + `%APPDATA%\npm\` + 常见安装目录（windows.mjs `resolveExecutable`，无大量猜测路径堆叠）
- 新增 Hermes 候选：`%LOCALAPPDATA%\hermes\hermes.exe`、`%LOCALAPPDATA%\Programs\hermes\hermes.exe`、`%APPDATA%\npm\hermes.cmd`

## 安全（§9）
- 输出仅来自本地 notes.json；不读 Cookie/history；不扫描无关目录；默认零写操作

## UI（§6/§7）
- AGENT BRIDGE 区块：**HERMES 第一项** + CODEX + CLAUDE CODE
- 每行三态：CONNECTED（`hermes mcp list` / `codex mcp list` / `claude mcp list` 实测输出含 shoucang-notes）/ AVAILABLE / NOT FOUND
- 按钮：CONNECT / REPAIR（= 先 remove 再 add，覆盖旧配置）/ COPY MANUAL CONFIG（命令+参数+env 一键复制）
- 不假装已连接：CONNECTED 由真实探测驱动
