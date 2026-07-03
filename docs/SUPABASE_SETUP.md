## Supabase 接入步骤

### 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com) 注册账号
2. 创建新项目（选择离你最近的区域，比如 Singapore 或 Tokyo）
3. 等待项目初始化完成（约 2 分钟）

### 2. 运行数据库 migration

1. 进入项目 Dashboard → SQL Editor
2. 复制 `supabase/migrations/001_initial_schema.sql` 的全部内容
3. 粘贴到 SQL Editor 并执行
4. 确认所有表创建成功（检查 Table Editor 中是否出现 `problems`, `solutions` 等表）

### 3. 配置环境变量

1. 进入项目 Settings → API
2. 复制 `Project URL` 和 `anon public` key
3. 在项目根目录创建 `.env.local` 文件：
   ```bash
   cp .env.local.example .env.local
   ```
4. 将复制的 URL 和 key 填入 `.env.local`

### 4. 验证连接

重启开发服务器：
```bash
npm run dev
```

如果没有报错，Supabase 已成功接入。

### 5. 迁移现有数据

当前 `data/problems.ts` 中的题目可以用脚本迁移到 Supabase：

```bash
npm run seed
```

如果 Supabase 环境变量缺失、查询失败或表为空，页面会回退到静态题库，避免首页和题库直接变空。

### 6. 投稿模型

`submissions` 同时承载两类投稿：

- `submission_type = 'problem'`：上传新题，`problem_id` 为空，`problem_source` 必填。
- `submission_type = 'solution'`：上传解法，必须绑定已有 `problem_id`。

注册用户会通过数据库 trigger 自动创建 `user_profiles`。管理员审核需要满足其中之一：

- `user_profiles.role` 是 `moderator` 或 `admin`
- 登录邮箱是 migration 中临时允许的管理员邮箱

### 7. Vercel 部署

Vercel 使用默认构建命令即可：

```bash
npm run build
```

需要在 Vercel Project Settings → Environment Variables 配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`（仅本地 seed 或受控后台脚本使用，不要暴露到浏览器）

当前本地沙箱里 Turbopack 可能因为端口绑定权限报错；这种情况下可用下面的命令验证业务代码：

```bash
npm run build:webpack
```

---

## Next Steps

- **Phase 1**: 用户注册/登录、个人投稿记录、管理员审核
- **Phase 2**: 新题投稿与解法投稿分流、Studio 结构化解法工作台
- **Phase 3**: 接入分享卡片生成（Vercel OG）
- **Phase 4**: 实现竞赛系统
