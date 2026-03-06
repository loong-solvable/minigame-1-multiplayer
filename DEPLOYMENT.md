# 服务器部署上线指南

## 1. 环境要求

- Node.js `20+`，建议 `24.x`
- Linux 服务器 1 台
- 已开放 `80` / `443` 端口
- 已准备好域名时，建议通过 Nginx 反向代理并启用 HTTPS

## 2. 上传代码并安装依赖

```bash
mkdir -p /srv/dino-hole-online
cd /srv/dino-hole-online
# 上传项目文件到当前目录
npm install
```

## 3. 本机验证

```bash
npm test
PORT=3000 npm start
```

浏览器访问 `http://<服务器IP>:3000`。

## 4. 生产启动

项目是一个 Node 进程，同时提供：

- 静态客户端页面
- WebSocket 联机服务

默认监听端口来自环境变量 `PORT`，未设置时为 `3000`。

## 5. 使用 systemd 常驻运行

创建 `/etc/systemd/system/dino-hole-online.service`：

```ini
[Unit]
Description=Dino Hole Rampage Online
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/dino-hole-online
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

启动并设置开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable dino-hole-online
sudo systemctl start dino-hole-online
sudo systemctl status dino-hole-online
```

## 6. 使用 Nginx 反向代理

创建站点配置，例如 `/etc/nginx/sites-available/dino-hole-online.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/dino-hole-online.conf /etc/nginx/sites-enabled/dino-hole-online.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 7. HTTPS

建议用 Certbot：

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

HTTPS 生效后，浏览器会自动通过 `wss://` 建立联机连接。

## 8. 上线检查清单

- `npm test` 通过
- `systemctl status dino-hole-online` 正常
- `nginx -t` 通过
- 浏览器能打开首页
- 两个浏览器窗口能创建 / 加入同一房间
- 房主能开始对局
- 对局结束后能再次开局

## 9. 更新发布

```bash
cd /srv/dino-hole-online
# 替换代码
npm install
npm test
sudo systemctl restart dino-hole-online
```

## 10. 故障排查

- 页面打不开：先检查 `PORT` 对应进程是否监听
- 页面能开但无法联机：重点检查 Nginx `/ws` 的 Upgrade 配置
- 玩家频繁掉线：检查反向代理超时、服务器防火墙和公网质量
- 更新后白屏：先确认 `index.html`、`styles.css`、`client/`、`assets/` 都已上传完整
