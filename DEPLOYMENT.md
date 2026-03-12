# 多人游戏部署指南（GitHub + 服务器）

最后更新：2026-03-12

这份文档面向你当前的发布路径：

1. 本地整理并测试代码
2. 上传到你自己的 GitHub 仓库
3. 在服务器上从 GitHub 拉取
4. 启动服务并完成验收

推荐方案是 Docker 部署。宿主机直跑仅作为备选。

## 1. 发布前本地检查

在本地项目根目录执行：

```bash
npm install
npm test
```

如果你怀疑目录里有生成垃圾，先预览再清理：

```bash
npm run clean:generated:dry
```

注意：

- 不要手工修改 `mobile-web/`
- 不要把 `android/app/src/main/assets/public` 当成源码
- 不要提交 `node_modules/`、日志、签名文件、keystore

## 2. 上传到 GitHub

如果仓库还没初始化：

```bash
git init
git add .
git commit -m "Initial deployable version"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

如果已经有远程：

```bash
git add .
git commit -m "Prepare server deployment"
git push
```

建议每次上线前都打 tag：

```bash
git tag 2026-03-12-01
git push origin 2026-03-12-01
```

## 3. 服务器前置条件

推荐环境：

- Git 2.x+
- Docker 24+ 与 Docker Compose 插件
- 或 Node.js 20（至少 Node 18）
- 服务器可以访问 `registry.npmjs.org` 与 Docker Hub

开放端口前先确认：

- 服务端口没有冲突
- 云安全组 / 防火墙已放行对应 TCP 端口
- 如果走反向代理，代理层支持 WebSocket Upgrade

## 4. 服务器目录建议

建议统一放在：

```bash
/data/project/minigame-1-multiplayer
```

如目录不存在：

```bash
sudo mkdir -p /data/project
sudo chown -R $USER:$USER /data/project
```

## 5. 服务器拉取代码

首次部署：

```bash
cd /data/project
git clone <your-github-repo-url> minigame-1-multiplayer
cd minigame-1-multiplayer
git rev-parse HEAD
```

后续更新：

```bash
cd /data/project/minigame-1-multiplayer
git fetch --all --tags
git pull
git rev-parse HEAD
```

如果你要锁定某个 tag：

```bash
git fetch --tags
git checkout 2026-03-12-01
```

## 6. Docker 部署（推荐）

### 6.1 构建镜像

```bash
cd /data/project/minigame-1-multiplayer
sudo docker build -t minigame-1-multiplayer:latest .
```

### 6.2 启动容器

下面示例把宿主机 `3001` 映射到容器内 `3000`：

```bash
sudo docker rm -f minigame-1-multiplayer 2>/dev/null || true
sudo docker run -d \
  --name minigame-1-multiplayer \
  -p 3001:3000 \
  --restart unless-stopped \
  minigame-1-multiplayer:latest
```

### 6.3 健康检查

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl http://127.0.0.1:3001/healthz
sudo docker logs --tail 100 minigame-1-multiplayer
```

`/healthz` 返回示例：

```json
{
  "ok": true,
  "uptimeSec": 12,
  "rooms": 0,
  "lobbyRooms": 0,
  "runningRooms": 0,
  "finishedRooms": 0,
  "humanPlayers": 0,
  "connectedHumans": 0,
  "bots": 0
}
```

## 7. 宿主机直跑（备选）

只有在你明确不走 Docker 时才用这条路径。

### 7.1 安装 Node

推荐：

```bash
nvm use
```

如果服务器没装 `nvm`，请先安装 Node 20。

### 7.2 安装依赖并启动

```bash
cd /data/project/minigame-1-multiplayer
npm ci --omit=dev
PORT=3001 npm start
```

建议不要直接挂在当前 shell。至少用 `systemd`、`pm2` 或 `nohup` 管理。

### 7.3 systemd 示例

```ini
[Unit]
Description=minigame-1-multiplayer
After=network.target

[Service]
Type=simple
WorkingDirectory=/data/project/minigame-1-multiplayer
Environment=PORT=3001
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3
User=deploy

[Install]
WantedBy=multi-user.target
```

## 8. 反向代理与域名

如果你要挂域名，建议由 Nginx/Caddy 反代到本服务端口，并保留 `/ws` 路径。

Nginx 示例：

```nginx
location / {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

注意事项：

- `/ws` 必须原样转发
- 必须透传 `Upgrade` 和 `Connection`
- 如果页面走 `https`，浏览器会要求 WebSocket 也走 `wss`

## 9. 更新流程

Docker 更新：

```bash
cd /data/project/minigame-1-multiplayer
git pull
sudo docker build -t minigame-1-multiplayer:latest .
sudo docker rm -f minigame-1-multiplayer
sudo docker run -d \
  --name minigame-1-multiplayer \
  -p 3001:3000 \
  --restart unless-stopped \
  minigame-1-multiplayer:latest
curl http://127.0.0.1:3001/healthz
```

宿主机更新：

```bash
cd /data/project/minigame-1-multiplayer
git pull
npm ci --omit=dev
sudo systemctl restart minigame-1-multiplayer
curl http://127.0.0.1:3001/healthz
```

## 10. 回滚流程

推荐做法：

- Git 打 tag
- Docker 镜像也打版本标签

镜像回滚示例：

```bash
sudo docker build -t minigame-1-multiplayer:2026-03-12-01 .
sudo docker rm -f minigame-1-multiplayer
sudo docker run -d \
  --name minigame-1-multiplayer \
  -p 3001:3000 \
  --restart unless-stopped \
  minigame-1-multiplayer:2026-03-12-01
```

Git 回滚示例：

```bash
git fetch --tags
git checkout 2026-03-12-01
```

## 11. 部署注意事项

- 不要把 `android/signing.properties`、`android/local.properties`、keystore 上传到 GitHub
- 不要把 `node_modules/`、日志、`mobile-web/`、Android 生成目录提交到仓库
- Docker 镜像里只需要服务端和根目录静态资源，不需要 APK 生成物
- 默认服务端口来自 `PORT`，容器内默认是 `3000`
- 如果你换了外部端口，比如映射成 `3001`，前端访问地址也要跟着这个端口
- 服务器构建镜像时，必须能解析并访问 `registry.npmjs.org`；如果 DNS 不稳定，优先修复 DNS/出网，而不是反复重试上线
- 如果通过域名和反代访问，优先保持“网页和 `/ws` 同域同端口”，这样网页端不需要额外配置
- 当前 APK 已内置 `http://3.219.133.87`，如果服务器地址变化，必须同步修改 [client/main.js](/Users/tqy/Code/business/minigame-1-multiplayer/client/main.js) 里的 `EMBEDDED_SERVER_URL` 并重新打包 APK
- 上线后先做 2 人联机实测，不要只看首页能打开

## 12. 上线验收

最少确认以下项目：

1. `curl http://127.0.0.1:<port>/healthz` 返回 `ok: true`
2. 打开首页正常，没有静态资源 404
3. 两个客户端可创建房间、加入房间、开始对局
4. 对局结束有结算页
5. `docker logs` 或服务日志中没有明显报错

## 13. 关联文档

- 项目说明：`README.md`
- 游玩与测试：`PLAY_GUIDE.md`
- 服务器交接说明：`SERVER_HANDOVER.md`
- 交接清单：`TRANSFER_CHECKLIST.md`
