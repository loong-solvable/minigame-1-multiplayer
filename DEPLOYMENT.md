# 服务器部署上线指南

## 1. 推荐部署方式

这项目在你当前服务器环境里，推荐走 `Docker`，不要直接依赖宿主机的 Node。

原因：

- 服务器是 `CentOS 7`
- 宿主机 `Node` 只有 `16.20.2`
- 宿主机 `git` 版本也较老
- 现有业务已经跑在 Docker 里
- `80` 端口已被 Docker 里的前端容器占用

因此最稳的做法是：

- 新服务也用 Docker 跑
- 映射到 `3001`
- 先直接通过 `http://服务器IP:3001` 做多人联测

## 2. 从 GitHub 拉代码

```bash
cd ~
git clone https://github.com/loong-solvable/minigame-1-multiplayer.git
cd ~/minigame-1-multiplayer
git rev-parse HEAD
```

## 3. 构建 Docker 镜像

项目已自带：

- `Dockerfile`
- `.dockerignore`

构建镜像：

```bash
cd ~/minigame-1-multiplayer
sudo docker build -t minigame-1-multiplayer:latest .
```

## 4. 启动容器

服务器当前端口占用情况：

- `80` 已占用
- `3000` 已被现有后端容器占用
- `3001` 可用于本项目

启动命令：

```bash
sudo docker run -d \
  --name minigame-1-multiplayer \
  -p 3001:3000 \
  --restart unless-stopped \
  minigame-1-multiplayer:latest
```

说明：

- 容器内部监听 `3000`
- 宿主机暴露 `3001`

## 5. 验证服务

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
curl http://127.0.0.1:3001
```

如果正常，外部可访问：

```text
http://54.165.178.190:3001
```

## 6. AWS 安全组

如果外网打不开，需要在 AWS 安全组里放行：

- 协议：`TCP`
- 端口：`3001`
- 来源：测试阶段可先 `0.0.0.0/0`

## 7. 更新发布

更新代码：

```bash
cd ~/minigame-1-multiplayer
git pull
```

重新构建并替换容器：

```bash
sudo docker build -t minigame-1-multiplayer:latest .
sudo docker rm -f minigame-1-multiplayer
sudo docker run -d \
  --name minigame-1-multiplayer \
  -p 3001:3000 \
  --restart unless-stopped \
  minigame-1-multiplayer:latest
```

## 8. 日志查看

```bash
sudo docker logs -f minigame-1-multiplayer
```

## 9. 后续接入统一 Nginx

当前不建议先动全局入口。

因为：

- 现有 Docker 前端容器已经占用 `80`
- 宿主机还没有统一接管 `80/443`

更稳的步骤应该是：

1. 先让联机测试通过
2. 再决定是否把当前 Docker Nginx 作为统一入口
3. 或者把宿主机 Nginx 提到最外层，再把旧容器退到内网端口

在没有域名和统一入口改造前，测试期直接访问 `:3001` 即可。

## 10. 故障排查

- 容器起不来：看 `sudo docker logs -f minigame-1-multiplayer`
- 外网打不开：优先检查 AWS 安全组是否放行 `3001`
- 服务没监听：看 `sudo ss -ltnp | grep 3001`
- 页面打开但联机失败：通常是反代 `/ws` 未升级；如果当前直接访问 `:3001`，通常不会有这个问题
