# APK 打包与签名发布说明（Capacitor + Android）

当前 APK 已内置服务器地址：`http://3.219.133.87`

含义：

- 手机安装 APK 后，打开即可直接连接这台服务器
- 不再需要用户手工填写 `Server URL`
- 房间码仍然保留，用户通过房间码进入具体对局房间

## 1. 前置环境

- Node.js 18+
- Android Studio（含 Android SDK、Build-Tools）
- JDK 17

## 2. 安装依赖

```bash
npm install
```

先检查 APK 构建环境是否齐全：

```bash
npm run apk:doctor
```

## 3. 初始化 Android 工程（只需一次）

```bash
npm run apk:init
```

## 4. 同步前端资源到 Android

```bash
npm run apk:sync
```

不要从别的目录手工复制 `mobile-web/` 或 `android/app/src/main/assets/public`。这两处都应由 `prepare:mobile-web` / `apk:sync` 重新生成。

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

Windows:

```bash
copy android\signing.properties.example android\signing.properties
```

macOS / Linux:

```bash
cp android/signing.properties.example android/signing.properties
```

2. 编辑 `android/signing.properties`：

```properties
storeFile=keystore/release.jks
storePassword=你的store密码
keyAlias=你的别名
keyPassword=你的key密码
```

3. 将 keystore 放到 `android/keystore/release.jks`（或改为你的路径）。

如果你还没有 keystore，可以自己生成一个：

```bash
keytool -genkeypair -v \
  -keystore android/keystore/release.jks \
  -alias release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

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

此 APK 仅封装前端资源，不内置 Node.js 游戏服。当前版本的连接方式是：

- Web 网页端：默认连接打开当前网页的同源服务器
- Android APK：默认连接内置服务器 `http://3.219.133.87`

客户端会自动切换到对应 WebSocket（默认 `/ws`）。

如果将来要更换 APK 内置服务器地址，修改这里：

- [client/main.js](/Users/tqy/Code/business/minigame-1-multiplayer/client/main.js)

搜索常量：

```js
const EMBEDDED_SERVER_URL = "http://3.219.133.87";
```

## 10. 常见环境问题（JDK / SDK）

### 10.1 JDK 版本

Android Gradle Plugin 8.2.1 需要 JDK 17。若 `gradlew` 报 JDK 11 错误，请切换 `JAVA_HOME` 到 JDK 17。

### 10.2 缺少 Android 34 组件

若报 `Failed to find Build Tools revision 34.0.0`，安装：

```bash
sdkmanager "platforms;android-34" "build-tools;34.0.0"
```

并确保 `android/local.properties` 中 `sdk.dir` 指向正确 SDK 路径。

### 10.3 macOS / Linux 构建脚本

项目现在的 `npm run apk:assemble:debug` / `apk:assemble:release` 已兼容 macOS、Linux、Windows。

如果你手工执行 Gradle：

- Windows 用 `gradlew.bat`
- macOS / Linux 用 `./gradlew`

### 10.4 Android 明文流量

当前内置服务器使用 `http://3.219.133.87`，不是 `https`。

因此项目已经在 Android 配置里放开明文流量访问，否则新版本 Android 上 APK 可能安装成功但无法联网。

对应配置：

- [AndroidManifest.xml](/Users/tqy/Code/business/minigame-1-multiplayer/android/app/src/main/AndroidManifest.xml)
- [network_security_config.xml](/Users/tqy/Code/business/minigame-1-multiplayer/android/app/src/main/res/xml/network_security_config.xml)

更稳妥的长期方案仍然是给服务器配置域名和 HTTPS，然后把 `EMBEDDED_SERVER_URL` 切到 `https://你的域名`。
