# 贡献指南

感谢你愿意参与 ProofArena。项目同时包含程序代码和数学内容，两类贡献的检查标准不同，请先确认你的修改属于哪一类。

## 开始之前

1. 查看现有 Issue，确认工作没有被重复进行。
2. 较大的功能或数据结构调整，请先创建 Issue 说明目标和方案。
3. 内容投稿请阅读 `docs/CONTENT_GUIDE.md` 和 `docs/SCORING.md`。
4. 程序贡献默认接受 AGPL-3.0-only；解法内容默认接受 CC BY-SA 4.0。

## 开发环境

```bash
npm install
npm run dev
```

提交前必须通过：

```bash
npm run lint
npm run build:webpack
```

`npm run lint` 当前执行 TypeScript 类型检查。`npm run build:webpack` 用于在本地沙箱里避开 Turbopack 端口绑定问题；普通环境也可以运行 `npm run build`。

## 分支与提交

建议使用清晰的分支名：

```text
feature/url-filters
fix/mobile-navigation
content/tj-2026-18-third-solution
docs/scoring-examples
```

提交信息应描述完成的结果，例如：

```text
Add URL-backed problem filters
Correct the geometric proof for Tianjin problem 17
Document the solution scoring rubric
```

## 程序贡献流程

1. 从 `app/` 确认页面入口。
2. 从 `components/` 找到负责展示或交互的组件。
3. 如需改变数据契约，先更新 `lib/types.ts`。
4. 如需改变持久化数据，补充 `supabase/migrations/` 并检查 RLS。
5. 保持静态 fallback：没有 Supabase 时核心浏览页仍应可用。
6. 同时检查深色、浅色和移动端。
7. 运行类型检查与生产构建。

PR 描述请写明：

- 改了什么
- 为什么需要修改
- 用户可见行为
- 如何验证
- 是否影响 Supabase schema、RLS、静态 fallback、数据格式或协议边界

## 数学内容贡献流程

1. 提供可核对的题目来源。
2. 确认解法与已有路线有实质区别，而不是只更换符号。
3. 写出思路来源、关键转化和完整过程。
4. 明确易错点与超纲工具。
5. 给出五维自评和简短依据。
6. 列出可验证步骤。
7. 由另一位贡献者或维护者复核关键推导。

正确性是合并的前提，不用高分掩盖尚未验证的步骤。

## 数据修改约定

- 题目 ID 使用稳定格式，例如 `tj-2026-18`。
- 解法 ID 在题目内唯一，例如 `tj18-slope`。
- LaTeX 使用 `$...$`，反斜杠在 TypeScript 字符串中需要转义。
- `summary` 中每个元素代表一个可独立阅读的推导步骤。
- 不把完整来源文章、书籍或第三方解析大段复制进仓库。
- 新增 PDF 前确认它确有页面引用，并控制仓库体积。

完整字段说明见 `docs/CONTENT_GUIDE.md`。

## UI 修改检查清单

- 360px 左右宽度无横向溢出
- 浅色和深色主题均有足够对比度
- 按钮与链接有明确可访问名称
- LaTeX 长公式可滚动或合理换行
- 无 Supabase 环境变量时，核心浏览页仍有合理 fallback
- 不把主要体验藏在仅桌面可见的入口中

## 内容审核检查清单

- 题干与来源一致
- 最终答案与推导一致
- 条件、定义域和分类讨论完整
- “思路来源”不是完整解法的重复
- “关键转化”确实指出决定性步骤
- 评分理由能够解释分数差异
- 超纲方法已明确标注
- 验证状态没有夸大

## Pull Request

保持一个 PR 只解决一个清晰问题。若同时修改代码和大量题解，请在描述中分别列出两类改动与协议归属。
