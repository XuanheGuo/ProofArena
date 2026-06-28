# OpenResty + Node.js 部署

本项目使用 Next.js standalone 运行模式。OpenResty 负责对外监听域名，Node.js 负责运行 Next.js 应用。

## 构建

```bash
npm ci
npm run build
```

`npm run build` 会自动把 `public/` 和 `.next/static/` 复制到 `.next/standalone/`。

## 启动 Node 服务

```bash
cd /path/to/ProofArena
HOSTNAME=127.0.0.1 PORT=3000 npm run start:standalone
```

也可以只上传 `proofarena-node-standalone.zip`。解压后进入解压目录，直接运行：

```bash
HOSTNAME=127.0.0.1 PORT=3000 node server.js
```

## OpenResty 反向代理

```nginx
server {
    listen 80;
    server_name your.domain;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 常见问题

- 不要把 `out/` 当作运行环境入口；`out/` 是旧的静态导出产物。
- 不要用 `next start` 跑 standalone 包；standalone 包入口是 `server.js`。
- 如果部署在子路径下，例如 `/proofarena/`，需要额外配置 Next.js `basePath`，否则资源路径会错。
