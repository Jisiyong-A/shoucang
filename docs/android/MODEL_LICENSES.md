# MODEL_LICENSES · 模型与第三方许可（Task 13 §10）

Date: 2026-08-12

## 模型许可（本机验证 + 官方声明）

| 模型 | 用途 | 大小 | 许可 | 分发方式 | 校验 |
|---|---|---|---|---|---|
| BAAI/bge-small-zh-v1.5 (Xenova ONNX int8) | 文本语义 | 23.9MB | **MIT**（BAAI 官方声明，Task 02 已核验） | 随 APK bundled | SHA-256 + 启动校验 |
| Xenova/chinese-clip-vit-base-patch16 (uint8) | 图文检索 | 190MB | **MIT**（OFA-Sys Chinese-CLIP；Xenova 转换层 Apache-2.0） | **Model Pack 下载**（可选 sideload） | SHA-256 + 安装校验 |
| tokenizer (bge/clip) | 分词 | <1MB | 同上 | bundled | — |

**选择依据（Task 02 结论）**：
- 文本模型 23.9MB → **Bundled**（安装即离线）
- 视觉模型 190MB → **Local Model Pack**（首次用户主动下载；提供离线 sideload 通道）——避免 APK 翻倍到 320MB+

### Model Pack 规格（Task 13 §3B）

```json
{
  "pack_version": "1",
  "models": [
    {
      "model_id": "cn-clip-vit-b16-uint8",
      "kind": "image_text",
      "license": "MIT",
      "license_url": "https://github.com/OFA-Sys/Chinese-CLIP/blob/master/LICENSE",
      "files": [
        { "path": "onnx/model_uint8.onnx", "sha256": "<hex>", "size": 199396352 },
        { "path": "tokenizer.json",        "sha256": "<hex>", "size": 415000 }
      ]
    }
  ]
}
```
- 下载：HTTPS only（release 禁 cleartext）
- 校验：每个文件 SHA-256 通过才标记 installed；校验失败 → failed 状态可 REPAIR
- sideload：用户手动放置包文件 → `VERIFY` 流程（checksum 同源）

## 第三方库许可（Android 侧）

| 组件 | 许可 |
|---|---|
| SQLite (bundled via rusqlite) | Public Domain |
| rusqlite | MIT |
| Tauri (Rust crate + CLI) | MIT OR Apache-2.0 |
| @tauri-apps/api | MIT OR Apache-2.0 |
| Next.js / React | MIT |
| AndroidX / Kotlin | Apache-2.0 |
| onnxruntime（若引入） | MIT |

> 完整许可文本随发布放 `THIRD_PARTY_NOTICES.md`（由 npm/rust licenses 工具生成，发布前一步）。

## AGPL 说明（Task 13 §11）

Android 版为原仓库（AGPL-3.0-or-later 声明）的衍生实现。若原仓库确为 AGPL：Android 版需保留 AGPL 相关要求（源码可得性声明、notices 保留）。**待确认原仓库 license 字段后落实**——已列入发布前检查单。
