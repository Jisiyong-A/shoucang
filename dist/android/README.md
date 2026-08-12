# 看看收藏 · Android 构建产物（Task 13）

## 文件

| 文件 | 用途 | 大小 |
|---|---|---|
| `kankan-arm64-release.apk` | release（R8 压缩 + debug keystore 签名，可 adb install） | 10.5MB |
| `kankan-arm64-debug.apk` | debug（本地构建，含完整调试符号） | 202MB（不入库） |

## 验证信息

- package: `com.patrick.kankanshoucang` v0.1.0 (versionCode 1000)
- ABI: arm64-v8a（Task 13 §2：release 单 ABI 优先）
- 权限: **仅 INTERNET**（无存储/位置/通讯录；ACTION_SEND 走 share URI grant）
- cleartext: release 禁用（`usesCleartextTraffic=false`）

## 复现

```bash
# Rust release lib（NDK linker 环境见 ANDROID_BOOTSTRAP_REPORT.md）
cd src-tauri
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="D:/Android/ndk/26.3.11579264/toolchains/llvm/prebuilt/windows-x86_64/bin/aarch64-linux-android21-clang.cmd"
cargo build --release --target aarch64-linux-android --features tauri/custom-protocol --lib
cp target/aarch64-linux-android/release/libkan_kan_shou_cang_lib.so gen/android/app/src/main/jniLibs/arm64-v8a/

cd gen/android
./gradlew :app:assembleArm64Release -x :app:rustBuildArm64Release
zipalign -f 4 app/build/outputs/apk/arm64/release/app-arm64-release-unsigned.apk \
  app/build/outputs/apk/arm64/release/app-arm64-release-aligned.apk
apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android \
  --out app/build/outputs/apk/arm64/release/app-arm64-release.apk \
  app/build/outputs/apk/arm64/release/app-arm64-release-aligned.apk
```

## Beta 前置（发布检查单见 PRIVACY_AUDIT.md）

- 正式 keystore 签名（当前 debug keystore 仅开发安装）
- AAB 打包（`gradlew :app:bundleArm64Release`）
- 模型分发：bge 23.9MB bundled + CLIP 190MB Model Pack（见 MODEL_LICENSES.md）
