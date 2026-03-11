# APK 打包与签名发布说明（Capacitor + Android）

## 1. 前置环境

- Node.js 18+
- Android Studio（含 Android SDK、Build-Tools）
- JDK 17

## 2. 安装依赖

```bash
npm install
```

## 3. 初始化 Android 工程（只需一次）

```bash
npm run apk:init
```

## 4. 同步前端资源到 Android

```bash
npm run apk:sync
```

## 5. 调试包构建（无需签名配置）

```bash
npm run apk:assemble:debug
```

输出：

- `android/app/build/outputs/apk/debug/app-debug.apk`

## 6. Release 签名配置（必做）

项目已支持两种方式读取 release 签名：

- `android/signing.properties`
- 环境变量（CI 推荐）

### 6.1 使用 signing.properties

1. 复制模板：

```bash
copy android\signing.properties.example android\signing.properties
```

2. 编辑 `android/signing.properties`：

```properties
storeFile=keystore/release.jks
storePassword=你的store密码
keyAlias=你的别名
keyPassword=你的key密码
```

3. 将 keystore 放到 `android/keystore/release.jks`（或改为你的路径）。

### 6.2 使用环境变量

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## 7. Release 构建

```bash
npm run apk:assemble:release
```

输出（APK）：

- `android/app/build/outputs/apk/release/app-release.apk`

若未配置签名，构建会直接失败并给出提示（已在 `android/app/build.gradle` 加保护）。

## 8. 推荐发布流程校验

1. 先跑 `apk:assemble:debug` 验证工程和资源同步。
2. 配置 release 签名。
3. 再跑 `apk:assemble:release`。
4. 用 `apksigner verify --print-certs <apk路径>` 检查签名证书。

## 9. 联机服务器说明

此 APK 仅封装前端资源，不内置 Node.js 游戏服。进入游戏后在首页填写：

- `Server URL (APK/远程联机)`（例如 `https://your-game-server.com`）

客户端会自动切换到对应 WebSocket（默认 `/ws`）。

## 10. 常见环境问题（JDK / SDK）

### 10.1 JDK 版本

Android Gradle Plugin 8.2.1 需要 JDK 17。若 `gradlew` 报 JDK 11 错误，请切换 `JAVA_HOME` 到 JDK 17。

### 10.2 缺少 Android 34 组件

若报 `Failed to find Build Tools revision 34.0.0`，安装：

```bash
sdkmanager "platforms;android-34" "build-tools;34.0.0"
```

并确保 `android/local.properties` 中 `sdk.dir` 指向正确 SDK 路径。
