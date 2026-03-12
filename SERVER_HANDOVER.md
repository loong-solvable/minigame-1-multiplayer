# 服务器交接总览

最后更新：2026-03-12

这份文档不再绑定某一台旧服务器的快照，而是作为你后续交接时可持续维护的模板。

## 1. 交接时必须补齐的信息

上线前或交接给他人前，请把下面信息更新完整：

- 服务器公网 IP / 域名
- 操作系统版本
- Docker 版本
- Git 版本
- 实际使用的部署方式：Docker / 宿主机直跑
- 实际使用的对外端口
- 代码仓库地址
- 当前线上提交号
- 最近一次上线时间

## 2. 当前项目的推荐交付形态

- 代码来源：GitHub 仓库拉取
- 运行方式：Docker 优先
- 健康检查：`/healthz`
- 服务端口：容器内默认 `3000`
- 对外端口：按服务器实际占用情况决定，例如 `3001`

## 3. 新接手同学先做什么

1. 先读 [DEPLOYMENT.md](/Users/tqy/Code/business/minigame-1-multiplayer/DEPLOYMENT.md)
2. 确认服务器端口占用与安全组策略
3. 执行一次 `curl http://127.0.0.1:<port>/healthz`
4. 执行一次 2 人联机回归
5. 记录当前 Git 提交号和镜像标签

## 4. 日常巡检命令

Docker 部署：

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
sudo docker logs --tail 100 minigame-1-multiplayer
curl http://127.0.0.1:3001/healthz
```

宿主机直跑：

```bash
ps -ef | grep node
ss -ltnp | grep 3001
curl http://127.0.0.1:3001/healthz
```

## 5. 常见故障

1. 首页可访问，但无法联机  
优先检查 `/ws` 是否被反向代理正确转发，以及是否透传 Upgrade 头。

2. 内网可访问，公网不可访问  
优先检查安全组、防火墙、负载均衡或反向代理。

3. 容器状态不断重启  
先看 `docker logs`，再看端口冲突和镜像构建是否包含正确代码。

4. APK 无法连到服务器  
先确认内置服务器地址 `http://3.219.133.87` 仍然有效；如果服务器已经迁移，修改 [client/main.js](/Users/tqy/Code/business/minigame-1-multiplayer/client/main.js) 中的 `EMBEDDED_SERVER_URL` 后重新打包 APK。其次检查服务器是否仍对外提供 `/ws`，以及安全组/反代是否放通。

## 6. 交接纪律

- 每次上线必须记录 Git 提交号或 tag
- 每次上线必须保留回滚目标
- 不要口头交接仓库地址、端口、域名，必须写进文档
- 如果更换了服务器或域名，第一时间更新 `DEPLOYMENT.md` 和本文件
