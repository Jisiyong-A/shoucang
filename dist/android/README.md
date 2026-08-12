# 收藏 · Android 构建产物

## 文件

| 文件 | 用途 | 大小 |
|---|---|---|
| `kankan-arm64-release.apk` | release（R8 压缩 + debug keystore 签名，可 adb install） | 10.5MB |
| `kankan-arm64-debug.apk` | debug（本地构建，含完整调试符号） | ~200MB（不入库） |

## 验证信息（2026-08-12，模拟器实测）

- package: `com.patrick.shoucang` v0.1.0 (versionCode 1000)
- **application-label: 收藏**
- ABI: arm64-v8a（Task 13 §2：release 单 ABI 优先）
- 权限: **仅 INTERNET**（无存储/位置/通讯录；ACTION_SEND 走 share URI grant）
- cleartext: release 禁用
- **设备级验收 ✅**：Android 模拟器（API 35 x86_64 + WHPX）上 App 启动、UI 渲染、
  Rust command round-trip 全通过（ANDROID CORE READY / android-x86_64 / ok /
  /data/user/0/com.patrick.shoucang）——见 docs/android/ANDROID_BOOTSTRAP_REPORT.md §6
- 截图: docs/android/screenshots/emu_home.png（模拟器实拍）

## 复现

```bash
# Rust release lib（NDK linker 环境见 ANDROID_BOOTSTRAP_REPORT.md）
cd src-tauri
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="D:/Android/ndk/26.3.11579264/toolchains/llvm/prebuilt/windows-x86_64/bin/aarch64-linux-android21-clang.cmd"
cargo build --release --target aarch64-linux-android --features tauri/custom-protocol --lib
cp target/aarch64-linux-android/release/libshoucang_lib.so gen/android/app/src/main/jniLibs/arm64-v8a/

cd gen/android
./gradlew :app:assembleArm64Release -x :app:rustBuildArm64Release
zipalign -f 4 app/build/outputs/apk/arm64/release/app-arm64-release-unsigned.apk \
  app/build/outputs/apk/arm64/release/aligned.apk
apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android \
  --out app/build/outputs/apk/arm64/release/app-arm64-release.apk \
  app/build/outputs/apk/arm64/release/aligned.apk
```

> 注意：改包名/identifier 后必须重编 .so（JNI 符号随 identifier 生成）且
> Kotlin generated 的 `System.loadLibrary("shoucang_lib")` 与 [lib] name 保持一致。

## Beta 前置（发布检查单见 PRIVACY_AUDIT.md）

- 正式 keystore 签名（当前 debug keystore 仅开发安装）
- AAB 打包（`gradlew :app:bundleArm64Release`）
- 模型分发：bge 23.9MB bundled + CLIP 190MB Model Pack（见 MODEL_LICENSES.md）
