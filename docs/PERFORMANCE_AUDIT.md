# 性能审查报告与优化方案

> 审查日期：2026-07-05。测量方式：本机 `npm run build` + `next start` 后用 curl 测 TTFB；
> 直接请求 Supabase REST / Auth 接口测延迟与数据量；分析 `.next/static/chunks` 产物体积。
> 注意：本机测量**不含** Vercel 函数冷启动和用户到 Vercel 的公网延迟，线上实际体验只会更差。

## 结论

慢的主因不是 Vercel 平台本身，而是项目从"纯静态站"迁移到 Supabase 之后，
**静态缓存全部失效**：核心页面（首页、题目列表、题目详情）每一次访问都变成了
"函数冷启动 → 中间件打一次 Supabase Auth → 拉 265KB 全量题库 JSON → 实时渲染"，
之后浏览器还要下载 2.5MB 首页背景图和约 1MB 的 JS 大包。每一层都在叠加延迟。

## 一次"打开题目详情页"的真实成本

1. 用户 → Vercel 边缘节点（大陆用户约 300ms–2s，见 P8）
2. 中间件 `supabase.auth.getUser()`：约 **230ms**，阻塞，匿名访客也要付（P3）
3. 页面是 `force-dynamic`，无缓存可用 → Vercel 函数冷启动 300ms–1s（P1）
4. `getProblem(id)` + `getProblems()` 全量查询：**265KB JSON，0.26s（热）～1.44s（冷）**（P2）
5. 浏览器下载 190KB HTML + **1.06MB chunk**（jsxgraph 与 KaTeX 打在一起，gzip 249KB）（P5/P6）
6. 首页另加 **2.5MB** 背景 PNG（P4）

## 实测数据

本机生产构建（`next start -p 3199`），curl 直连：

| 页面 | 渲染方式 | TTFB（首次 / 二次） | HTML 体积 |
|---|---|---|---|
| `/`（首页） | ƒ 动态 | **1.53s** / 0.14s | 77KB |
| `/problems` | ƒ 动态 | 0.19s / 0.15s | **542KB**（gzip 80KB） |
| `/problems/[id]` | ƒ 动态 | 0.23s / 0.21s | 190KB |
| `/library` | ○ 静态 | **0.015s** / 0.005s | 376KB |
| `/about` | ○ 静态 | **0.008s** | 31KB |

静态页与动态页 TTFB 相差 15–100 倍。其他实测：

- `getProblems()`（`select('*, solutions(*)')`）：265KB JSON，0.26–1.44s
- Supabase Auth `getUser()`：约 0.23s / 次
- 最大客户端 chunk：1.06MB（gzip 249KB），内含 jsxgraph + KaTeX；客户端 JS 总量 2.7MB
- `public/arena-background.png`：2.5MB（1672×941 PNG）
- KaTeX CSS 打入全局样式（约 120KB CSS + 20 个 woff2 字体，按需加载）

---

## 问题清单与解决方案

### P1 静态缓存全面失效，核心页面全部按请求实时渲染 【最高优先级】

**现象**：`npm run build` 的路由表里 `/`、`/problems`、`/problems/[id]`、`/contests` 全是
ƒ (Dynamic)。`app/page.tsx` 和 `app/problems/page.tsx` 写的 `revalidate = 3600` 被静默忽略。

**根因**（三个叠加）：

1. `lib/supabase-server.ts` 的 `createClient()` 调用 `cookies()`。Next.js 里读 cookie
   会让整个路由强制退出静态/ISR 渲染。而题库是公开数据，根本不需要带 cookie 的客户端。
2. `app/problems/[id]/page.tsx:8` 显式声明 `export const dynamic = "force-dynamic"`。
3. 服务端读 `searchParams`（`/problems` 的筛选参数、详情页的 `?contest=` 参数）同样强制动态。

**解决方案**：

第一步，给公开数据换一个不读 cookie 的客户端：

```ts
// lib/supabase-public.ts（新增）
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
```

`lib/db.ts` 的 `getProblems` / `getProblem`（以及 `lib/contests.ts` 中的公开读取）
改用 `createPublicClient()`。需要登录态的读写（评分、投稿、后台）继续用原来的
`createClient()`，不受影响。

第二步，恢复详情页静态化（`app/problems/[id]/page.tsx`）：

```ts
export const revalidate = 3600;          // 替换 force-dynamic

export async function generateStaticParams() {
  const problems = await getProblems();
  return problems.map((p) => ({ id: p.id }));
}
```

第三步，把 searchParams 的读取移到客户端，否则页面仍是动态：

- `/problems`：初始筛选参数改由 `ProblemExplorer` 内部用 `useSearchParams()` 读
  （组件已是 client component，外层套 `<Suspense>` 即可），服务端页面不再接收 `searchParams`。
- `/problems/[id]` 的 `?contest=` 上下文：拆成客户端小组件读取参数后按需取数，
  或改用独立路由 `/contests/[slug]/problems/[id]`。这是详情页能否静态化的关键。

第四步，内容更新的即时性靠按需失效，不靠动态渲染。在后台发布/审核通过的写路径
（`lib/publish-submission.ts`、`lib/save-proof-graph.ts` 等）里调用：

```ts
import { revalidatePath } from 'next/cache';

revalidatePath('/problems');
revalidatePath(`/problems/${problemId}`);
revalidatePath('/');
```

**预期收益**：`/`、`/problems`、`/problems/[id]` 变回 ○/● 静态，命中 Vercel CDN 边缘缓存，
TTFB 从 500ms–2s 降到 50–150ms，且不再受函数冷启动影响；Supabase 只在构建/再验证时被访问。

---

### P2 每个请求拉全量数据（265KB），详情页尤其浪费

**现象**：`lib/db.ts` 的 `getProblems()` 是 `select('*, solutions(*)')` —— 所有题目连同
所有解法全文。详情页除了 `getProblem(id)` 还调了一次 `getProblems()`，仅仅为了算
4 个"相关题目"；首页拉全量只为了 3 道精选题和几个统计数字。

**解决方案**：

1. 新增轻量查询，只取摘要字段：

```ts
const PROBLEM_SUMMARY_COLUMNS =
  'id, year, region, paper, number, difficulty, question_type, tags, title, heat';

export async function getProblemSummaries(): Promise<ProblemSummary[]> { ... }
```

2. 详情页的"相关题目"改用 `getProblemSummaries()`（打分逻辑只用到 tags/region/difficulty）。
3. 首页改为 `getProblemSummaries()` + 按 id 精确取 3 道精选题
   （`.in('id', featuredIds)` 带 `solutions(*)`）。
4. P1 落地后此项从"每请求成本"降级为"每次再验证成本"，但仍值得做：
   减小构建时间和 RSC 序列化体积（见 P6）。

---

### P3 中间件在每个请求上阻塞式调用 Supabase Auth

**现象**：`proxy.ts` 的 matcher 覆盖几乎所有页面路由，每次导航都
`await supabase.auth.getUser()`（实测约 230ms 往返）——包括没有任何登录 cookie 的
匿名访客，而访客是绝大多数流量。注意：即使页面静态化，Vercel 上中间件仍会在
命中缓存之前执行，所以这项必须单独修。

**解决方案**：

1. 无 auth cookie 直接放行：

```ts
// proxy.ts，创建 supabase client 之前
const hasAuthCookie = request.cookies
  .getAll()
  .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
if (!hasAuthCookie) return supabaseResponse;
```

2. matcher 收窄到真正依赖服务端会话的路由：

```ts
export const config = {
  matcher: ['/admin/:path*', '/profile/:path*', '/studio/:path*', '/submit', '/auth/:path*'],
};
```

**预期收益**：匿名访客每次导航省约 230ms；公开页面彻底绕开中间件。

---

### P4 首页 LCP 元素是 2.5MB 的 PNG，且关闭了图片优化

**现象**：`next.config.ts` 设了 `images: { unoptimized: true }`，
`app/page.tsx:27` 的 `<Image src="/arena-background.png" fill priority>` 会原样下发
整张 2.5MB 图。这基本决定了首页"看起来加载完"的时间（LCP）。

**解决方案**（二选一，推荐都做）：

1. 源头压缩：转成 WebP/AVIF，这张图压到 150–250KB 无可见损失：

```bash
npx sharp-cli --input public/arena-background.png \
  --output public/arena-background.webp --format webp --quality 78
```

   然后把 `app/page.tsx` 的引用改为 `.webp`，并给 `<Image>` 补 `sizes="100vw"`。
2. 既然部署在 Vercel，可移除 `unoptimized: true` 让平台做响应式优化
   （注意 Hobby 套餐有每月优化额度；先做第 1 条则额度压力很小）。

**预期收益**：首页下载量约 -2.3MB，移动端 LCP 改善最明显。

---

### P5 jsxgraph 被急切加载，且和 KaTeX 打进同一个 1MB chunk

**现象**：`components/FunctionGraphPanel.tsx:31` 和 `components/MathVisualization.tsx:67`
在**模块顶层**就发起 `import("jsxgraph")`；这两个组件又被 `ProblemDetailExperience`
静态引入 —— 打开任何题目详情页都会下载 jsxgraph，不管该题有没有图。
构建产物中 jsxgraph 和 KaTeX 融合进了同一个 1.06MB chunk（gzip 249KB），
用到公式的页面（几乎所有页面）都会被连带。

**解决方案**：

1. 删掉两处模块顶层的 `const jsxgraphPromise = ... import("jsxgraph")`，
   组件 `useEffect` 里已有 `await import("jsxgraph")` 兜底，行为不变但变成真按需。
2. 在 `ProblemDetailExperience` 里用 `next/dynamic` 引入图形组件，把它们和 KaTeX 拆开：

```tsx
import dynamic from 'next/dynamic';

const FunctionGraphPanel = dynamic(
  () => import('@/components/FunctionGraphPanel').then((m) => m.FunctionGraphPanel),
  { ssr: false }
);
const MathVisualization = dynamic(
  () => import('@/components/MathVisualization').then((m) => m.MathVisualization),
  { ssr: false }
);
```

   （`mathVizProblemIds` 这类常量导出需要挪到独立的轻量模块，避免为了取常量把整个组件拉进来。）
3. 改完后跑 `npm run build`，确认 jsxgraph 不再出现在与 katex 相同的 chunk 里。

**预期收益**：无图页面 JS -1MB（未压缩）/ -249KB（gzip）；含图页面按需延迟加载，不阻塞首屏。

---

### P6 `/problems` 把整个数据集序列化进 HTML（542KB）

**现象**：全量 `problems`（含所有解法全文）作为 props 传给客户端组件
`ProblemExplorer`，数据被序列化进 HTML/RSC payload，页面达 542KB（gzip 80KB）。
列表页只需要每题的摘要字段。

**解决方案**：配合 P2 的 `getProblemSummaries()`，`/problems` 页面只向
`ProblemExplorer` 传列表 DTO（id、title、tags、region、difficulty、questionType、
year、paper、number、heat、解法数量）。若现有筛选/搜索逻辑依赖解法字段，
把所需字段收敛为最小集合加进 DTO，而不是整包传。

**预期收益**：`/problems` 的 HTML 从 542KB 降到几十 KB 量级，低端设备解析开销同步下降。

---

### P7 Vercel 函数 region 可能与 Supabase 不同区【待确认】

**现象**：Vercel 默认把函数放在 `iad1`（美东）。若 Supabase 项目在亚太区，
每次数据库/Auth 往返都要跨洋 150–200ms。P1 落地后此项影响大幅缩小
（只剩再验证和登录态路由），但仍值得对齐。

**解决方案**：

1. Supabase 控制台 → Settings → General 确认项目 Region。
2. `vercel.json` 固定函数区域，与之同区或最近，例如东京：

```json
{ "regions": ["hnd1"] }
```

3. 项目已接入 `@vercel/speed-insights`：先看面板确认线上瓶颈是 TTFB 还是 LCP、
   访客地域分布，和本报告的本机数据对照。

---

### P8 大陆用户访问 Vercel/Supabase 的结构性延迟【战略层面】

**现象**：`*.vercel.app` 域名在大陆经常不可达；绑定自定义域名后 Vercel 在大陆
也没有节点，TTFB 常见 500ms–2s+；Supabase 同样在境外。以高考数学的受众看，
这可能是"体感很慢"里占比最大、且**无法靠代码优化解决**的一块。

**解决方案**：

1. 优先把 P1–P6 做完 —— 页面全静态 + 资源瘦身后，境外延迟只影响首字节，
   体感会明显改善。
2. 若仍不达标，把面向大陆的部署放回自己的服务器（香港服务器免备案，大陆服务器需 ICP 备案）。
   仓库已有完整方案：`docs/OPENRESTY_NODE_DEPLOY.md`。
   注意：`next.config.ts` 中 `output: "standalone"` 已被移除，
   `scripts/prepare-standalone.mjs` 目前是跳过状态 —— 走这条路需要把配置加回来。
3. 静态化（P1）同时解决了自建部署的数据延迟问题：页面在构建/再验证时取数，
   用户请求不再碰境外的 Supabase。

---

## 实施路线图

| 阶段 | 内容 | 工作量 | 预期效果 |
|---|---|---|---|
| 一（立刻） | P3 中间件减负、P4 压缩首页图 | 约半天 | 每次导航 -230ms；首页 -2.3MB |
| 二（核心） | P1 恢复静态缓存 + P2 查询瘦身 | 1–2 天 | 核心页 TTFB 降到 <150ms，消除冷启动 |
| 三（打磨） | P5 拆 jsxgraph、P6 列表 DTO、P7 region 对齐 | 1 天 | 无图页 -249KB gzip JS；列表页 -490KB HTML |
| 四（战略） | P8 大陆部署评估 | 视情况 | 解决大陆访问的结构性延迟 |

## 验证清单

- [ ] `npm run build` 路由表：`/`、`/problems`、`/problems/[id]` 显示 ○ 或 ●（不再是 ƒ）
- [ ] `curl -w "%{time_starttransfer}"` 复测四个核心路由，对照本报告数据
- [ ] 详情页 Network 面板：无图题目不加载 jsxgraph chunk
- [ ] `/problems` 文档体积降到 100KB 以下（未压缩）
- [ ] 后台发布内容后，前台 1 分钟内可见（验证 `revalidatePath` 生效）
- [ ] 上线一周后复查 Vercel Speed Insights 的 P75 TTFB / LCP
