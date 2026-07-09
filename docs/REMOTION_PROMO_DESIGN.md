# ProofArena Remotion 宣传片设计

> 目标：做一支优雅、克制、精致、有质感的项目宣言片。它不是普通产品广告，而是让观众在 60 秒内理解 ProofArena 的内核：数学解法不该只是答案文本，而应该成为可比较、可挑战、可验证、可传承的推理资产。

## 1. 核心创意

### 片名

**同一道题，不同思路。**

副标题：

**ProofArena / The Arena for Mathematical Reasoning**

### 一句话

ProofArena 把一道题的多条解法、观察入口、关键转化、验证步骤和挑战关系组织成一张 proof graph，让数学推理从静态答案变成可以被比较、复盘和共同改进的网络。

### 气质

- 高级数学纪录片
- Apple keynote 式克制节奏
- 学术感，但不冷
- 结构美感，而不是炫技科技感
- 黑底、纸白、微青、少量琥珀高光

### 必须避免

- 不做普通 SaaS 产品宣传片
- 不说“更快找到答案”
- 不做大面积霓虹、赛博、玻璃拟态
- 不堆功能点
- 不用夸张粒子、卡通角色、游戏化音效

## 2. 影片结构

推荐主版本：**60 秒 / 16:9 / 4K 或 1080p / 30fps**

可派生：

- 30 秒社媒短版
- 15 秒 Logo 片头
- 90 秒招募版

节奏原则：

```text
慢开场 -> 第一次分叉 -> 快速展示系统能力 -> 安静落点 -> Logo 收束
```

前 20 秒不要出现完整网站界面。先建立“问题、推理、分叉、比较”的内涵，再让产品界面出现，避免一开始像网页录屏。

### 融合版叙事骨架

吸收外部规划书中的“书本醒来 / 证明飞出 / 混乱收束成竞技场”母题，但不把后半段做成功能清单。最终叙事应是：

```text
书本中的证明醒来
  -> 散落的题目、解法、评论、评分飞出纸面
  -> 信息风暴收束成一个极简数学竞技场
  -> 不同解法像选手一样进入同一场域
  -> 比较、验证、挑战关系沉淀为 Proof Graph
  -> ProofArena Logo 与项目宣言收束
```

这一版比单纯网页展示更有品牌感，也比单纯概念动画更能落到 ProofArena 的真实产品能力。

## 3. 60 秒分镜

### 0-8s / The Book：数学从书中醒来

画面：

- 黑色空间中，一本白色书本悬浮在画面中央偏下。
- 背景不是纯黑，而是极微弱的深灰渐变、体积光和纸张颗粒。
- 柔和聚光灯从上方落下，书本从模糊到清晰。
- 书本轻轻打开，第一页透出非常克制的白色光。

字幕：

```text
数学，不止有答案。
```

旁白：

```text
一道题，通常只被要求得到一个答案。
```

Remotion 实现：

- `SceneBookOpening`
- `FloatingBook`
- `SubtleGrid`
- `Spotlight`
- `DustField`

技术提示：

- 书本先用 CSS 3D 模拟，不必建真实 3D 模型。
- 用 `transform-style: preserve-3d`、`rotateX`、`rotateY`、层叠页面 div 和柔光阴影做高级概念片质感。
- 动画要慢、稳、有光，不要像 PPT 翻页。

### 8-18s / Proof Unfolds：证明展开

画面：

- 书页开始翻动，页面上隐约出现函数图像、几何图形、不等式推导和证明步骤。
- “关键观察”“解法一”“解法二”“评分”“评论”等结构词从纸面浮出。
- 数学元素围绕书本旋转，信息量逐渐增加，但运动轨迹保持有秩序。
- 最后形成一点“散落但尚未被组织”的张力。

字幕：

```text
一道题，不止一种解法。
```

旁白：

```text
真正值得保存的，是它为什么成立，以及还可以怎样抵达。
```

Remotion 实现：

- `SceneProofUnfolds`
- `FormulaParticleField`
- `PageFlip`
- `FloatingMathLabel`

可用数学元素：

```text
f'(x)=0
a^2+b^2 >= 2ab
S_n=a_1(1-q^n)/(1-q)
关键观察
辅助线
等价转化
构造函数
分类讨论
一题多解
```

### 18-30s / Chaos to Arena：混乱收束成竞技场

画面：

- 从书中飞出的公式、证明、题目卡片短暂形成“数学信息风暴”。
- 所有元素被吸引到画面中央，线条自动对齐，重组成一个极简竞技场。
- 竞技场由圆环、网格、中央擂台、两侧解法卡、顶部评分条和少量评论气泡构成。
- 一个问题卡片悬在中心，三条路线向右分叉，展开成三张精致路线卡：
  - 教学解：清晰、稳、适合讲解
  - 几何解：看见结构
  - 代数解：可复算、可验证

字幕：

```text
同一道题，不同思路。
```

旁白：

```text
ProofArena 把同一道题的不同解法，放在同一个场域里正面比较。
```

Remotion 实现：

- `SceneChaosToArena`
- `ArenaRings`
- `ProblemNode`
- `SolutionRouteCard`
- `AnimatedConnector`
- `CommentBubble`

### 30-39s / 比较不是排名，是理解

画面：

- 三张路线卡滑入一个五维评价矩阵。
- 五个维度以细线刻度出现：
  - 正确性
  - 考场性
  - 结构美感
  - 计算量
  - 讲解友好
- 某条路线在“结构美感”上亮起，另一条在“考场性”上亮起。

字幕：

```text
正确，只是第一层。
```

旁白：

```text
一个解法可以更稳，一个解法可以更美，一个解法可以更适合考场。
```

Remotion 实现：

- `ScoreMatrix`
- `MetricAxis`
- `RouteComparison`

### 39-48s / Proof Graph

画面：

- 评价矩阵向后淡出，路线节点变成一张 proof graph。
- 节点依次亮起：
  - Observation
  - Transformation
  - Verification
  - Boundary
  - Challenge
- 每个节点只停 0.5 秒，保持克制。

字幕：

```text
从答案文本，到推理网络。
```

旁白：

```text
观察、转化、验证、边界、挑战关系，会一起沉淀为 proof graph。
```

Remotion 实现：

- `ProofGraphReveal`
- `GraphNode`
- `GraphEdge`
- `NodePulse`

### 48-55s / 产品界面出现

画面：

- 第一次出现真实 ProofArena 页面，但不是普通全屏录屏。
- 使用三段精裁镜头：
  - 题目详情页中的解法比较
  - Proof Graph 矩阵
  - Studio / 投稿结构化字段
- 界面作为画面材料出现，保持边缘裁切和景深，不让网页 chrome 抢戏。

字幕：

```text
阅读。比较。提交。挑战。
```

旁白：

```text
学习者在这里比较路线，贡献者在这里提交思路，审核者把好的推理沉淀下来。
```

Remotion 实现：

- `ProductShotSequence`
- `FramedAppShot`
- `CalloutLine`

素材来源：

- 用 Playwright 截取本地页面高清截图
- 优先截局部区域，不直接展示完整浏览器

### 55-60s / 收束与招募

画面：

- 所有路线回到一个安静的 ProofArena 标识。
- 背景保留几条几乎不可见的 proof graph 线条。
- 最后一秒停留，不急着切掉。

字幕：

```text
ProofArena
让数学推理进入竞技场。
```

可选招募版字幕：

```text
加入我们，一起重建题解的组织方式。
```

备选收束语：

```text
在联系中建立理解，
在对比中看清边界。
```

旁白：

```text
ProofArena，让数学推理进入竞技场。
```

Remotion 实现：

- `LogoResolve`
- `FinalTagline`
- `GraphAfterglow`

## 4. 旁白完整稿

60 秒主版：

```text
一道题，通常只被要求得到一个答案。

但答案不是推理的终点。
真正值得保存的，是它为什么成立，以及还可以怎样抵达。

ProofArena 把同一道题的不同解法，放在同一个场域里正面比较。

一个解法可以更稳，一个解法可以更美，一个解法可以更适合考场。

观察、转化、验证、边界、挑战关系，会一起沉淀为 proof graph。

学习者在这里比较路线，贡献者在这里提交思路，审核者把好的推理沉淀下来。

ProofArena，让数学推理进入竞技场。
```

更前瞻的招募版结尾：

```text
我们不是在做一个更快的答案站。
我们在重建数学推理被组织、比较和传承的方式。

ProofArena，让数学推理进入竞技场。
```

## 5. 视觉系统

### 色彩

```text
Background     #050507
Panel          #0b0d10
Paper          #f6f2e8
Text Primary   #f8fafc
Text Muted     #9ca3af
Cyan Accent    #67e8f9
Amber Accent   #f6c76b
Red Accent     #f87171
Line           rgba(255,255,255,0.14)
```

### 字体建议

中文：

- 思源宋体 / Noto Serif SC：用于宣言字幕
- 思源黑体 / Noto Sans SC：用于界面标注

英文与数字：

- Inter
- JetBrains Mono：用于坐标、编号、proof graph 节点名

### 画面元素

- 细线网格
- 极轻纸纹
- 数学公式显影
- 节点与边
- 精裁 UI 截图
- 五维评价矩阵

### 动效语言

- 位置移动少，透明度、裁切、描线增长为主
- 曲线使用 `spring`，但阻尼高
- 镜头以 1.02-1.08 的微缩放为主
- 节点出现不要弹跳，使用低调亮起
- 关键停顿要保留 12-24 帧

## 6. Remotion 结构建议

目录：

```text
remotion/
  Root.tsx
  compositions/ProofArenaPromo.tsx
  scenes/
    SceneBookOpening.tsx
    SceneProofUnfolds.tsx
    SceneChaosToArena.tsx
    SceneBranchingRoutes.tsx
    SceneScoreMatrix.tsx
    SceneProofGraph.tsx
    SceneProductShots.tsx
    SceneLogoResolve.tsx
  components/
    FloatingBook.tsx
    MathLine.tsx
    FormulaParticleField.tsx
    SubtleGrid.tsx
    Spotlight.tsx
    ArenaRings.tsx
    ProblemNode.tsx
    SolutionRouteCard.tsx
    CommentBubble.tsx
    AnimatedConnector.tsx
    MetricAxis.tsx
    GraphNode.tsx
    FramedAppShot.tsx
    Caption.tsx
  data/
    formulas.ts
    promoCopy.ts
    mockArena.ts
  styles/
    theme.ts
  assets/
    screenshots/
    textures/
```

Composition：

```text
id: ProofArenaPromo60
width: 3840
height: 2160
fps: 30
durationInFrames: 1800
```

开发预览可以用 1920x1080，最终渲染再切 4K。

工程规范：

- 所有关键文案、公式、题目 mock 数据放入 `data/`，不要散落在 scene 组件里。
- 建立统一 `theme.ts`，集中管理颜色、字号、间距、阴影和时间点。
- 关键时间点抽成常量，例如 `SCENE_BOOK_START`、`SCENE_ARENA_START`、`SECOND`。
- 动画以 Remotion 的 `interpolate`、`spring`、`Easing` 为主，避免用 CSS keyframes 承担主要叙事动画。
- 第一版先使用抽象 UI 和 mock 数据，第二版再替换真实页面截图。

## 7. 实现阶段

### Phase 1：静态动画版

目标：不依赖真实网页截图，先把影片节奏跑通。

交付：

- 60 秒 Remotion composition
- 旁白字幕
- 题目、三条路线、评分矩阵、proof graph、Logo 收束

验收：

- 静音播放仍然能看懂
- 前 20 秒不出现产品页面
- 不像普通在线教育广告

### Phase 2：真实产品镜头

目标：加入 ProofArena 局部 UI 截图。

交付：

- Playwright 截图脚本
- `/problems/[id]` 解法比较局部图
- Proof Graph / Studio / 投稿审核局部图
- Product shot scene 替换占位图

验收：

- UI 截图不暴露杂乱页面 chrome
- 文案和截图位置不重叠
- 画面仍保持电影感，不退化成屏幕录制

### Phase 3：声音与导出

目标：完成可发布版本。

交付：

- 中文旁白
- 轻音乐或极简氛围音
- 4K 横版
- 1080p 横版
- 1080x1920 竖版重排

验收：

- 60 秒内信息密度不过载
- 最后 3 秒 Logo 和理念清楚
- 手机静音观看时字幕可读

## 8. 可复用短版

### 30 秒版

结构：

```text
0-5s   一道题
5-12s  三条解法分叉
12-20s 五维比较 + Proof Graph
20-26s 产品局部镜头
26-30s Logo + 让数学推理进入竞技场
```

### 15 秒版

结构：

```text
0-4s   一道题
4-9s   教学解 / 几何解 / 代数解分叉
9-12s  Proof Graph 节点亮起
12-15s ProofArena Logo
```

## 9. 第一版素材建议

优先选择一道“有明显多解法分叉”的题作为视觉母题。建议从当前首页精选题中选：

- `ng2-2026-18`
- `ng1-2026-18`
- `tj-2026-09`

选题标准：

- 至少 3 条可比较解法
- 题干视觉上不太长
- 能自然命名为教学解、几何解、代数解或结构解
- 有关键转化、方法边界、验证步骤可展示

## 10. 主视觉草图

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         一道题                              │
│                  f(x), geometry, inequality                 │
│                                                             │
│                            │                                │
│             ┌──────────────┼──────────────┐                 │
│             │              │              │                 │
│          教学解          几何解          代数解              │
│       stable route    structure      verifiable             │
│             │              │              │                 │
│             └──────────────┼──────────────┘                 │
│                            │                                │
│                      Proof Graph                            │
│        Observation -> Transformation -> Verification        │
│                                                             │
│             ProofArena / 让数学推理进入竞技场                 │
└─────────────────────────────────────────────────────────────┘
```
