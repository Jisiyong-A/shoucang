# ANDROID_BOOTSTRAP_REPORT · Tauri Android Bootstrap

Date: 2026-08-12
Branch: `android-semantic-local`

## 1. 状态摘要

```text
APK BUILT:    ✅ app-arm64-debug.apk (104.3MB, com.patrick.kankanshoucang, arm64-v8a)
REACT UI:     ✅ 静态导出已打包进 APK（next output:'export'）
RUST CORE:    ✅ libkan_kan_shou_cang_lib.so 交叉编译并打入 APK
COMMANDS:     ✅ get_platform_info / get_app_data_dir / health / bootstrap_status
UI STATUS:    ✅ BootstrapStatus 组件（ANDROID CORE READY / DESKTOP CORE READY）
NO NODE:      ✅ Android 构建无 node.exe sidecar、无 localhost:4318
DEVICE TEST:  ⏸ PENDING——本机无 Android 真机（adb devices 为空），
              launch/UI渲染/command round trip/生命周期测试需用户连接设备后执行
```

## 2. 环境（本次全新安装）

| 组件 | 版本 | 位置 |
|---|---|---|
| JDK | Temurin 17.0.20+8（ZIP 免安装版，MSI 被卡死的 msiexec 阻塞绕开） | `D:\Android\jdk-17.0.20+8` |
| Android SDK | cmdline-tools latest (11076708) | `D:\Android\cmdline-tools\latest` |
| platform-tools (adb) | 1.0.41 | `D:\Android\platform-tools` |
| platforms | android-34, android-36 | `D:\Android\platforms\` |
| build-tools | 34.0.0, 35.0.0, 35.0.1 | `D:\Android\build-tools\` |
| NDK | r26d (26.3.11579264) | `D:\Android\ndk\26.3.11579264` |
| Rust targets | aarch64-linux-android, armv7-linux-androideabi, i686-linux-android, x86_64-linux-android | rustup |
| Tauri | CLI 2.10.0 / crate 2.10.2 / @tauri-apps/api 2.10.1 | repo |
| Gradle | 8.14.3 (wrapper) | ~/.gradle |

环境变量（setx 持久化）：`JAVA_HOME=D:\Android\jdk-17.0.20+8`、`ANDROID_HOME=D:\Android`、`ANDROID_SDK_ROOT=D:\Android`、`ANDROID_NDK_HOME=D:\Android\ndk`。

## 3. 架构变更（Task 03 §5 Platform Separation）

```
src-tauri/src/
├── main.rs            # 薄壳：kan_kan_shou_cang_lib::run()
├── lib.rs             # app builder + #[cfg_attr(mobile, tauri::mobile_entry_point)]
├── commands.rs        # get_platform_info / get_app_data_dir / health / bootstrap_status
└── platform/
    ├── mod.rs         # cfg 分发
    ├── desktop.rs     # Node sidecar 生命周期（桌面行为与原来完全一致）
    └── android.rs     # 无 Node；setup_local_api 显式空实现
```

- Cargo.toml 增加 `[lib] crate-type=["staticlib","cdylib","rlib"]`（Tauri mobile 必需）。
- package.json 增加 `"tauri": "tauri"` script（gradle 插件依赖）。
- 前端新增 `app/components/BootstrapStatus.tsx`（invoke 4 个 command，浏览器降级为 WEB PREVIEW）。

## 4. 构建流程与踩坑记录（Windows 特有，均已解决）

1. **sdkmanager 下载损坏**：`platform-34_r02.zip` 在 Google 仓库已 404（sdkmanager 会下载到 404 页面 → "unknown archive"）。正解：从 repository2-3.xml 查真实 URL（`platform-34-ext7_r02.zip`），curl 手动下载解压。
2. **tauri CLI 的 cmdline-tools 路径**：检查 `$ANDROID_HOME/cmdline-tools/bin/sdkmanager`（旧布局，无 latest）。用 junction：`cmd /c 'mklink /J D:\Android\cmdline-tools\bin D:\Android\cmdline-tools\latest\bin'`。
3. **NDK 安装中断**：sdkmanager 首次 NDK 解压被打断后目录缺失但 --list_installed 误报已装。手动下载 android-ndk-r26d-windows.zip 解压到 `ndk/26.3.11579264`。
4. **许可证文件**：sdkmanager --licenses 说接受但未落盘 → 手动写 `licenses/android-sdk-license` + `android-sdk-preview-license`（标准 hash 文件）。
5. **符号链接**：tauri CLI 把 .so symlink 进 jniLibs 需要 Windows Developer Mode（无管理员权限）。绕过：手动 cp .so 到 `gen/android/app/src/main/jniLibs/arm64-v8a/`，Gradle 直接打包。
6. **Gradle wrapper 下载损坏**：wrapper 下载的 zip 常截断；用腾讯镜像 curl 下载（131MB）后复制到 dist 目录。
7. **gradle rustBuild 任务**：调 `npm run tauri android android-studio-script`，依赖 CLI 的 options server（`tauri android build` 启动）；直接跑 gradle 会 panic 读 server-addr 文件。绕过：`./gradlew :app:assembleArm64Debug -x :app:rustBuildArm64Debug`（.so 已手动放置）。
8. **npm.bat**：本机便携 node 在 D:\hermes\node（只有 npm.cmd），创建了 npm.bat shim 供 Gradle 查找。
9. **@tauri-apps/api 2.10.0 发布残缺**（只有 src 无 dist，npm 注册表事故）→ 用 2.10.1（与 Rust tauri 2.10.x 匹配）。

## 5. 复现命令

```bash
# 全量（CLI 流程；本机因 symlink 权限需先手动放 .so 并跳过 rustBuild）
export JAVA_HOME=D:\\Android\\jdk-17.0.20+8 ANDROID_HOME=D:\\Android ANDROID_SDK_ROOT=D:\\Android
cd src-tauri
cargo build --target aarch64-linux-android --features tauri/custom-protocol --lib
cp target/aarch64-linux-android/debug/libkan_kan_shou_cang_lib.so \
   gen/android/app/src/main/jniLibs/arm64-v8a/
cd gen/android && ./gradlew :app:assembleArm64Debug -x :app:rustBuildArm64Debug
# 产物: gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk
```

## 6. 待办（外部条件）

### ✅ 模拟器验收（2026-08-12，Windows 11 + Android Emulator + WHPX）

本机无真机，改用 **Android 模拟器（API 35 x86_64，WHPX 加速）** 完成设备级验收：

| 项 | 结果 |
|---|---|
| App 启动 | ✅ MainActivity resumed，进程稳定 |
| React UI 渲染 | ✅ 收藏界面完整渲染（截图存证） |
| **Rust command round-trip** | ✅ **ANDROID CORE READY**（WebView CDP DOM 验证） |
| get_platform_info | ✅ `android-x86_64` |
| health | ✅ `ok` |
| get_app_data_dir | ✅ `/data/user/0/com.patrick.shoucang`（filesDir 可写） |
| 无 Node 依赖 | ✅ 无 sidecar、无 4318 |

模拟器搭建要点：emulator/system-image 手动 curl 下载（sdkmanager 下载损坏）；AVD 手动 config.ini（avdmanager 需 package.xml）；`| head` 会 SIGPIPE 杀模拟器（日志重定向到文件）。

```bash
# 模拟器构建通道（x86_64 debug）
adb install -r app-x86_64-debug.apk
adb shell am start -n com.patrick.shoucang/.MainActivity
# WebView 调试（MainActivity 已启用 setWebContentsDebuggingEnabled）
adb forward tcp:9223 localabstract:webview_devtools_remote_$(adb shell pidof com.patrick.shoucang | tr -d '
')
```

### 待真机验收

1. 真机（arm64）安装 + 视觉确认（模拟器上 fixed 调试徽标有 WebView 合成层不渲染的边缘问题，真机待确认）
2. Sharesheet（Task 04）+ OCR worker + 移动 UI（Task 11）
3. 性能实测（model load / warm query / RAM）
