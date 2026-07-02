# knight-html-ppt-skill
> 一款高质量的 AgentSkill，让 AI 做出真正能打的 HTML 演示文稿。
> **36 套主题**、**15 套完整 deck 模板**、**31 种页面布局**、**47 个动效**
> (27 个 CSS + 20 个 Canvas FX)，加上产品级 **演讲者模式** —— 自适应
> 讲义视图 + 可编辑逐字稿 + 主题化总览。纯静态 HTML/CSS/JS，无需构建。
> 面向正式汇报、技术分享和产品叙事的** HTML PPT Agent Skill**。    

基于 [lewislulu/html-ppt-skill](https://github.com/lewislulu/html-ppt-skill) 的主题、模板、布局、动画和演讲者模式能力，进一步沉淀各种交付级场景的版式规范、数据动效、页面导览和交付检查流程，让 AI 生成的 HTML 演示稿更接近可直接投屏的正式成果。

![HTML PPT Studio preview](https://raw.githubusercontent.com/lewislulu/html-ppt-skill/main/docs/readme/hero.gif)

## 产品定位

`knight-html-ppt-skill` 是一个“HTML 演示稿生产基座”：

- 用静态 HTML/CSS/JS 交付，可直接在浏览器中打开和演示。
- 默认适配正式汇报，强调清晰、稳重、数据生动和页面不溢出。
- 保留模板化生产能力，适合根据材料快速生成多页演示稿。
- 强化数字、条形图、SVG 流程图等数据可视化动效。
- 内置键盘、鼠标滚轮、演讲者备注、侧边导览和页面总览能力。
- 内置 `V` 键交互式编辑模式，可直接改文字、拖拽位置、调整尺寸和保存 HTML。
- 可按内容精选主题组合，并通过 `T` 键在多主题之间切换。

适用场景包括：产品分享、技术分享、项目复盘、培训课程、发布会材料、汇报、周/月总结和多页图文内容等。
## Skill 内容一览

| | 数量 | 位置 |
|---|---|---|
| 🎤 **演讲者模式** | **新增** | `S` 键 / `?presenter=1` / `?preview=N` |
| ✍️ **交互式编辑** | **新增** | `V` 键 / `assets/editor.js` / `assets/editor.css` |
| 🎨 **主题** | **36** | `assets/themes/*.css` |
| 📑 **完整 deck 模板** | **15** | `templates/full-decks/<name>/` |
| 🧩 **单页布局** | **31** | `templates/single-page/*.html` |
| ✨ **CSS 动画** | **27** | `assets/animations/animations.css` |
| 💥 **Canvas FX 动画** | **20** | `assets/animations/fx/*.js` |
| 🖼️ **Showcase deck** | 4 | `templates/*-showcase.html` |
| 📸 **验证截图** | 56 | `scripts/verify-output/` |

## 继承的原始能力

上游 `html-ppt-skill` 已经提供了一套完整的 HTML PPT Studio 能力，本项目在此基础上做产品化增强。

| 能力 | 内容 |
| --- | --- |
| 主题系统 | 36 套 CSS Token 主题，可通过一个主题文件切换整体视觉 |
| 整套模板 | 15 套 full-deck templates，覆盖产品发布、技术分享、周报、课程等场景 |
| 单页布局 | 31 种页面布局，如封面、目录、KPI、表格、流程、时间线、图表等 |
| 动画体系 | 27 个 CSS 动画 + 20 个 Canvas FX 动效 |
| 演讲者模式 | 支持当前页、下一页、可编辑逐字稿和计时器的独立演示窗口 |
| 交互式编辑 | 按 `V` 进入编辑模式，支持文字、位置、尺寸、样式、撤销重做和 HTML 保存 |
| 静态交付 | 纯 HTML/CSS/JS，无需构建步骤 |
### 36 套主题

`minimal-white`、`editorial-serif`、`soft-pastel`、`sharp-mono`、`arctic-cool`、
`sunset-warm`、`catppuccin-latte`、`catppuccin-mocha`、`dracula`、`tokyo-night`、
`nord`、`solarized-light`、`gruvbox-dark`、`rose-pine`、`neo-brutalism`、
`glassmorphism`、`bauhaus`、`swiss-grid`、`terminal-green`、`xiaohongshu-white`、
`rainbow-gradient`、`aurora`、`blueprint`、`memphis-pop`、`cyberpunk-neon`、
`y2k-chrome`、`retro-tv`、`japanese-minimal`、`vaporwave`、`midcentury`、
`corporate-clean`、`academic-paper`、`news-broadcast`、`pitch-deck-vc`、
`magazine-bold`、`engineering-whiteprint`

每个主题都是一份纯 CSS token 文件 —— 只需要换一行 `<link>` 就能给整份 deck
换皮。在 `templates/theme-showcase.html` 里可以浏览全部（每一页用独立 iframe
渲染，避免样式互相污染）。
|演讲者视图（按S进入） | 主题 |
| --- | --- |
| ![Presenter mode](https://raw.githubusercontent.com/lewislulu/html-ppt-skill/main/docs/readme/presenter-mode.png) | ![Themes](https://raw.githubusercontent.com/lewislulu/html-ppt-skill/main/docs/readme/themes.png) |

| 模板 | 布局与动画 |
| --- | --- |
| ![Templates](https://raw.githubusercontent.com/lewislulu/html-ppt-skill/main/docs/readme/templates.png) | ![Layouts](https://raw.githubusercontent.com/lewislulu/html-ppt-skill/main/docs/readme/layouts.png) |

### 31 种单页布局

cover · toc · section-divider · bullets · two-column · three-column ·
big-quote · stat-highlight · kpi-grid · table · code · diff · terminal ·
flow-diagram · timeline · roadmap · mindmap · comparison · pros-cons ·
todo-checklist · gantt · image-hero · image-grid · chart-bar · chart-line ·
chart-pie · chart-radar · arch-diagram · process-steps · cta · thanks

每个布局都带真实的示例数据，拖进 deck 立即看得到效果。

![31 种布局通过真实模板文件自动循环播放](docs/readme/layouts-live.gif)

*大 iframe 直接加载 `templates/single-page/<name>.html` 文件，每 2.8 秒
自动切换到下一个布局。*

![47 个动效 · 27 CSS + 20 Canvas FX](docs/readme/animations.png)

### 27 个 CSS 动画 + 20 个 Canvas FX

**CSS 动画（轻量）** — 方向性淡入、`rise-in`、`zoom-pop`、`blur-in`、
`glitch-in`、`typewriter`（打字机）、`neon-glow`（霓虹光晕）、
`shimmer-sweep`（流光）、`gradient-flow`（渐变流动）、`stagger-list`
（列表错开入场）、`counter-up`（数字滚动）、`path-draw`（路径绘制）、
`morph-shape`、`parallax-tilt`、`card-flip-3d`、`cube-rotate-3d`、
`page-turn-3d`、`perspective-zoom`、`marquee-scroll`、`kenburns`、
`ripple-reveal`、`spotlight`、…

**Canvas FX（电影级）** — `particle-burst`（粒子爆发）、`confetti-cannon`
（彩带）、`firework`（烟花）、`starfield`（星空）、`matrix-rain`
（代码雨）、`knowledge-graph`（力导向知识图谱）、`neural-net`（神经网络
脉冲）、`constellation`（星座连线）、`orbit-ring`（轨道环）、
`galaxy-swirl`（星系漩涡）、`word-cascade`、`letter-explode`、
`chain-react`、`magnetic-field`、`data-stream`、`gradient-blob`、
`sparkle-trail`、`shockwave`、`typewriter-multi`、`counter-explosion`。
每一个都是手写的 canvas 模块，进入 slide 时由 `fx-runtime.js` 自动初始化。

## 增强能力

### 1. 产品级演示体验

- 讲义视图（键盘S进入）由 `CURRENT`、`NEXT`、逐字稿和计时器组成，打开、刷新和调整窗口后都会自动恢复稳定排版。
- 逐字稿可直接编辑并自动保存，`Ctrl+B` 会变成主题强调色。
- 每份 deck 可从 36 套主题中按内容选择 3 套风格，`T` 键切换；`data-anim` 入场会在翻页时重播，重点页可叠加少量 Canvas FX。

### 2. 增强默认规范

- 默认使用 16:10 演示比例，适合会议室大屏和常规投屏。
- 默认交付 HTML 演示稿，不强制转成 PPTX。
- 每页默认加入隐藏演讲备注，正常投屏不可见，只在备注或演讲者模式中查看。
- 页面可见内容禁止出现来源、制作过程、工具名、生成说明等与交付过程相关的描述。
- 正文、表格、脚注、图表标签、SVG 文字等最小字号统一不低于 14px。
- 页面主体在页眉和页脚之间尽量垂直居中，避免下方大面积空白。
- 汇报页脚、页码和进度反馈保持克制，不喧宾夺主。

### 3. 数据页动效

针对演示汇报中常见的数字、条形图和流程图，固化了更稳定的入场动效：

- 数字指标从 `0` 递增到目标值。
- 条形图、进度条、对比条从 `0` 宽度增长到目标长度。
- SVG 流程、数据流向、治理闭环使用路径描边、脉冲、扫描和流动效果。

### 4. 页面导航体验

在原有键盘翻页基础上，增加了更适合现场演示的页面定位能力：

- `E` 键打开左侧页面导览栏，展示页面缩略图、页码和标题。
- 鼠标移到最左侧悬停区，延迟打开导览栏，在鼠标移开后自动收起。

### 5. 全屏页面总览

- `O` 键进入页面总览。
- 缩略图根据页面数量自动计算行列。
- 背景、卡片、标题和当前页高亮跟随当前主题，避免总览页和正文页气质割裂。

### 6. 在线编辑模式

- `V` 键进入编辑模式，顶部工具条提供保存、撤销、重做、加粗、字号、颜色和对齐。
- 点击选择标题、正文、卡片、图片等常见元素；拖拽移动，拖动控制点调整尺寸。
- 双击文字可直接编辑，粘贴时自动转纯文本，避免外部富文本污染页面。
- 保存按钮和 `Ctrl+S` 使用浏览器保存能力：优先复用已授权的文件句柄；没有权限时会弹出另存为/选择文件；不可用时自动下载一份修改后的 HTML。

### 7. 最终版式和字体检查

交付前建议执行固定检查：

- 渲染每一页截图，确认比例为 16:10（或自定义其它比例）。
- 检查标题、正文、图表、页脚、页码没有溢出或重叠。
- 检查小字号是否低于 14px。
- 检查每页主体是否在页眉和页脚之间保持视觉居中。
- 检查可见文字中没有来源、制作、工具、生成过程等描述。
- 检查数字递增、条形增长、SVG 动画和页面切回重播是否正常。
- 检查键盘、滚轮、`E` 导览、`O` 总览、`S` 演讲者模式和隐藏备注。
- 检查 `V` 编辑模式、`Ctrl+Z` / `Ctrl+Y`、Esc 保存提示和导出的 HTML。
- 使用浏览器自动化或 Playwright 做控制台、截图和布局校验。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `←` / `→` / `Space` / `PgUp` / `PgDn` | 页面切换 |
| 鼠标滚轮 | 上一页 / 下一页 |
| `F` | 全屏 |
| `S` | 演讲者模式 |
| 讲义视图当前页区域滚轮 | 同步切换上一页 / 下一页 |
| 逐字稿中 `Ctrl+B` | 强调 / 取消强调 |
| `N` | 备注抽屉 |
| `O` | 全屏页面总览 |
| `E` | 左侧页面导览 |
| `V` | 进入 / 退出交互式编辑模式 |
| 编辑模式 `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| 编辑模式 `Ctrl+S` | 保存 / 另存为 HTML |
| 编辑模式 `Esc` | 提示保存、放弃或继续编辑 |
| `T` | 切换主题 |
| `A` | 切换示例动画 |
| `Esc` | 关闭导览、总览或弹层 |

## 快速开始

手动 / 安装到支持 Agent Skills 的环境 / git clone 后：

```bash
npx skills add https://github.com/knight6669/knight-html-ppt-skill
```

从模板创建一份演示稿：

```bash
./scripts/new-deck.sh my-report
open examples/my-report/index.html
```

Windows PowerShell：

```powershell
.\scripts\new-deck.ps1 my-report
Start-Process .\examples\my-report\index.html
```

装好后，任何支持 AgentSkill 的 agent（Claude Code / Codex / Cursor / OpenClaw 等）
都能用这套能力做 PPT。对 agent 说：

> "做一个小红书图文，9 张，白底柔和风"
> "做一份带演讲者模式的产品分享，我想要有逐字稿"  
> "做一份 8 页的技术分享 slides，用 cyberpunk 主题"
> "把这段 outline 变成投资人 pitch deck"

> "基于这份材料生成一份 18 页正式汇报用 HTML PPT"
> "要求 16:10、每页有隐藏演讲备注、数据页有数字递增和条形增长动画"

## 目录结构

```
knight-html-ppt-skill/
├── SKILL.md                      agent 入口
├── README.md                     英文 README
├── README.zh-CN.md               本文件
├── references/                   详细文档
│   ├── themes.md                 36 主题 + 使用场景
│   ├── layouts.md                31 布局
│   ├── animations.md             27 CSS + 20 FX 目录
│   ├── full-decks.md             15 完整 deck 模板
│   ├── presenter-mode.md         🎤 演讲者模式 + 逐字稿指南
│   └── authoring-guide.md        完整工作流
├── assets/
│   ├── base.css                  共享 tokens + 基础组件
│   ├── fonts.css                 web 字体引入
│   ├── runtime.js                键盘导航 + 演讲者模式 + 总览
│   ├── themes/*.css              36 主题 token 文件
│   └── animations/
│       ├── animations.css        27 个命名 CSS 动画
│       ├── fx-runtime.js         进入 slide 自动初始化 [data-fx]
│       └── fx/*.js               20 个 Canvas FX 模块
├── templates/
│   ├── deck.html                 最小起步模板
│   ├── theme-showcase.html       iframe 隔离的主题 tour
│   ├── layout-showcase.html      全部 31 布局
│   ├── animation-showcase.html   47 动画 slide
│   ├── full-decks-index.html     15 deck gallery
│   ├── full-decks/<name>/        15 个 scoped 多页 deck 模板
│   └── single-page/*.html        31 个布局文件（带示例数据）
├── scripts/
│   ├── new-deck.sh               脚手架
│   ├── render.sh                 headless Chrome → PNG
│   └── verify-output/            56 张自测截图
└── examples/demo-deck/           完整可运行的示例 deck
```

## 设计原则/理念

- **把“能生成”升级为“能汇报”**：默认关注投屏、可读性、字体大小、数据可信和交互稳定。
- **把“页面好看”升级为“现场好用”**：支持快速定位页面、回到当前页、查看备注和总览缩略图。
- **把“动画装饰”升级为“数据表达”**：数字、条形图和 SVG 动效优先解释信息关系。
- **把“交付 HTML”升级为“交付可验收成果”**：每次交付前做截图、文字、字体和交互检查。
- **Token 驱动的设计系统。** 所有颜色、圆角、阴影、字体决策都在
  `assets/base.css` + 当前主题文件里。改一个变量，整份 deck 优雅地重排。
- **Iframe 隔离预览。** 主题 / 布局 / 完整 deck 的 showcase 都用 `<iframe>`，
  确保每个预览都是真实、独立的渲染结果。
- **零构建。** 纯静态 HTML/CSS/JS。只有 webfont / highlight.js / chart.js
  (可选) 走 CDN。
- **资深设计师的默认值。** 字号规律、间距节奏、渐变、卡片处理都有态度 ——

## Roadmap

- 增加场景汇报、数据型分析、项目复盘等专用 full-deck 模板。
- 增加更完整的自动质检脚本，输出页面溢出、小字号和禁用词。
- 增加更丰富的中文图表组件和数据页模板。
- 为页面导览、总览和演讲者模式提供更多主题外观。

## 致谢与许可

本项目基于 [lewislulu/html-ppt-skill](https://github.com/lewislulu/html-ppt-skill) 的 MIT 许可代码与设计体系进行扩展。README 中的部分预览图来自上游项目的 `docs/readme/` 目录，用于说明继承能力。  

请在发布仓库时保留原项目许可和致谢信息。本项目新增部分默认按 MIT License 发布，除非你在仓库中另行声明。

## 关于作者

Knight | 贺 | 持续探索 vibe-coding
