# CAS 校验服务

ProofArena 的 CAS 校验用于辅助审核投稿中的代数步骤。它只检查可解析的等式、等式链和结论等价，不替代人工审题、定义域检查或分类讨论。

## Vercel 部署

仓库根目录的 `api/cas_service.py` 是 Vercel Python Runtime 入口，`requirements.txt` 声明运行依赖。推送到 GitHub 后，Vercel 会在同一个项目中部署：

- Next.js 路由：`/api/cas`
- Python CAS 函数：`/api/cas_service`

前端统一请求 `/api/cas`。线上环境中，`app/api/cas/route.ts` 会通过 `VERCEL_URL` 自动代理到同项目的 `/api/cas_service`，无需额外配置。

## 本地开发

如果只运行 `next dev`，Python Runtime 不会自动启动。可以另起 CAS 服务，然后设置：

```bash
CAS_SERVICE_URL=http://localhost:8000 npm run dev
```

独立 Python 服务需要暴露：

- `POST /verify/steps`
- `POST /verify/equivalence`

## 校验边界

- 单独的 `x=1` 会被记录为条件，不会被标成“证明通过”。
- `x^2=4 -> x=2` 会被标成“代回上一条成立”，但不会证明唯一性。
- `2x+2=4 -> x+1=2` 会被识别为等价变形。
- 含文字步骤需要用 `$...$` 标出可解析的数学表达式。
