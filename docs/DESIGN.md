# 教学工作台 · Design System

> **Identity**：Approachable luxury · Morandi sage · watercolor wash · monochromatic glass.
> **Audience**：师范院校教育学院教师（教育学 / 小学教育 / 学前教育），本地单人工作台。
> **For**：实现 UI 的大语言模型与人类。先读 §0 与 §3，再读组件。
> **Code**：`src/glass.css`（壳层）· `src/dashboard.css`（概览）· `public/glass-sky.jpg`（大气层）。

本文是视觉与交互的**唯一设计源**。与 `docs/prd.md` 冲突时：产品范围听 PRD，观感听本文。提示词包见 `docs/design-prompts/`。

---

## 0. Non-negotiables

实现任何界面前，用这一节否决方案。

### MUST

- 气质是 **approachable luxury**：安静、触感好、像一件做工讲究的器物，不是秀场、不是仪表盘皮肤。
- 色彩策略是 **monochromatic sage**：同一色相（约 148°–158°）的深浅与灰化，用水彩叠洗分层，而不是多色品牌盘。
- 布局是 **card-based + layered**：大气层 → 壳层 → 舞台 → 卡片 → 嵌套碎片。英雄区可以不装进卡片，但右侧/次级信息必须成卡。
- 毛玻璃配方固定：半透明底 + `backdrop-filter: blur(16–24px) saturate(1.3–1.45)` + 1px 高光描边 + 内高光。
- 中文 UI 用 **Noto Sans SC**；数字/时刻用 **Outfit**。禁止 Inter / Roboto / Arial / Space Grotesk 作为主字体。
- 概览页（`#/overview`）走沉浸风景玻璃；其他路由把原有内容放进 **page-sheet**（浅色磨砂底板），不要把深色字直接写在风景上。
- 侧栏桌面可收起为 84px 图标轨，展开 228px；窄屏用抽屉，不把图标轨硬塞进 390px。

### NEVER

- 紫粉霓虹渐变、AI-purple mesh、彩虹标签、纯黑描边、硬投影 `#000` 大面积。
- 高饱和红绿做状态（用莫兰迪陶土 / 苔绿灰化替代）。
- 三等分功能卡片、居中 SaaS hero、玻璃套玻璃超过 3 层。
- 为科技感加青蓝霓虹、扫描线、全息彩虹；科技气质只在**同一苔色相**里提高对比与几何精度（见 §9）。
- 用 emoji 当导航图标（用 1.7px stroke 的线描 SVG）。
- 为了「豪华」加金箔、大理石、衬线堆砌、大面积 serif 标题墙。

---

## 1. Product temperament

| 项 | 值 |
|---|---|
| 哲学 | Approachable luxury：亲近的讲究。老师每天打开，应感到被好好对待，而不是被设计震慑。 |
| 场所感 | 校园黄昏田野 / 雨后林荫，不是机房，不是行政灰。 |
| 材料 | 磨砂玻璃、水彩薄涂、干苔、雾、素瓷。 |
| 声音 | 短句、具体、不喊口号。「今日连堂满课」优于「赋能您的教学旅程」。 |
| 密度 | 概览偏舞台（VISUAL_DENSITY 4–5）；课表/成绩偏工作面（6–7）。 |
| 动效 | MOTION 3–4。展开侧栏 280ms ease；hover 只改变玻璃不透明度。禁止循环漂浮。 |

一句话：**把天气应用的玻璃舞台，换成教育学院教师的日常节奏台。**

---

## 2. Color — Morandi sage, watercolor wash, mono

整套系统锁在 **Sage / Moss** 一条色带上。所谓 Morandi：低饱和、带灰、邻色差极小。所谓 watercolor wash：同一色素以 4%–22% 透明度叠两到三层，边缘柔、心子略深。

### 2.1 Hue lock

- 主色相：**152° ± 6°**（绿中带灰青）。
- 饱和度工作区间：**8%–28%**。卡片玻璃用低饱和；照片上的叠洗可以到 32%，但 UI 色块不超过 28%。
- 明度从苔黑 8% 到雾白 97%。交互状态只走明度/透明度，不换色相。

### 2.2 Core tokens

实现时写入 CSS 变量。名称稳定，禁止页面级另起一套绿。

```css
:root {
  /* Ink on sheet (浅色底板页) */
  --moss-00: #101814;
  --moss-05: #152018;
  --moss-10: #1c2a22;
  --moss-20: #24362c;
  --moss-30: #2c4d3d;   /* accent-deep */
  --moss-40: #3f6b56;   /* accent */
  --moss-50: #5f7f70;
  --moss-60: #7a9788;
  --moss-70: #9bb0a4;
  --moss-80: #c5d4cc;
  --moss-90: #e4ece7;
  --moss-95: #f3f7f4;
  --mist:    #f7fbf8;

  /* Glass on atmosphere (深色风景上) */
  --glass:        rgba(247, 251, 248, 0.12);
  --glass-strong: rgba(247, 251, 248, 0.20);
  --glass-border: rgba(247, 251, 248, 0.26);
  --glass-text:   #f7fbf8;
  --glass-muted:  rgba(247, 251, 248, 0.74);
  --glass-subtle: rgba(247, 251, 248, 0.52);

  /* Watercolor washes — 叠在照片或卡片里，不是实心色块 */
  --wash-ink:  rgba(16, 24, 20, 0.32);
  --wash-mid:  rgba(36, 54, 44, 0.18);
  --wash-sage: rgba(143, 163, 150, 0.16);
  --wash-fog:  rgba(247, 251, 248, 0.10);
  --wash-clay: rgba(176, 137, 104, 0.14); /* 仅节日/警告轻涂，面积 < 4% */

  --radius-xs: 10px;
  --radius-sm: 14px;
  --radius-md: 22px;
  --radius-lg: 26px;
  --radius-pill: 999px;
}
```

### 2.3 Roles（单色如何分工）

| 角色 | Token | 用法 |
|---|---|---|
| Atmosphere void | `--moss-05` | 照片未载入时的底 |
| Overlay | `--wash-ink` → `--wash-mid` 纵向渐变 | 压住风景，保证白字对比 |
| Glass fill | `--glass` / `--glass-strong` | 侧栏、卡片、圆钮 |
| Glass stroke | `--glass-border` | 1px；可加 `inset 0 1px 0 rgba(255,255,255,.16)` |
| Text on glass | `--glass-text` / `--muted` / `--subtle` | 三级不换色相 |
| Text on sheet | `--moss-10` 作墨，`--moss-50` 作次要 | 其他路由底板 |
| Accent | `--moss-40` | 浅色底上的主按钮、进度条 |
| Badge | 苔色相上的陶土洗 `--wash-clay` 实心约 `#c4a090` | 数量提醒，全产品唯一暖点 |
| Danger | `#8f5b50`（灰陶） | 截止、需关注；禁止 `#e11d48` |
| Warning | `#9a7b56`（枯叶） | 待更新 |
| Success | `--moss-40` | 正常、已完成 |

**单色纪律**：专业标签（教育学 / 小教 / 学前）不要蓝/青绿/紫三色体系。改成同一苔色的明度差 + 文字区分：`--moss-30` / `--moss-40` / `--moss-50` 底 + `--mist` 字，或全部改成 `--glass-strong` 底。若必须保留旧色，只出现在 **page-sheet 内** 的小标签，不出现在概览英雄区。

### 2.4 Watercolor wash recipe

大气层（`app-shell::before`）必须是「照片 × 洗」而不是纯 CSS 网格：

```css
background:
  linear-gradient(180deg, var(--wash-ink) 0%, var(--wash-fog) 38%, var(--wash-mid) 100%),
  radial-gradient(80% 50% at 70% 10%, var(--wash-sage), transparent 60%),
  url("/glass-sky.jpg") center / cover no-repeat;
background-color: var(--moss-20);
```

卡片内部可加一层极淡的径向洗（不透明度 ≤ 0.08），模拟釉面，不要条纹、不要噪点 GIF。颗粒感若需要，用 4% overlay 的单色 film grain，blend-mode `overlay`，且不得盖住文字。

### 2.5 Contrast

- 风景上的大标题：白字，对比视作 `#fff` on ~`#3a4a40`，目标 ≥ 7:1。
- 玻璃次要文字用不低于 `--glass-subtle`（约 52% 白）；更淡则只用于装饰轴。
- 底板页正文用 `--moss-10`，不要用纯黑。

---

## 3. Typography

| 角色 | 字体 | 字重 | 用法 |
|---|---|---|---|
| UI | `"Noto Sans SC", "PingFang SC", sans-serif` | 400 / 500 / 600 / 650 | 导航、正文、按钮 |
| Display number | `"Outfit", "Noto Sans SC", sans-serif` | 500 / 650 / 700 | 时刻、周次、大数字 |
| Display Chinese | 仍用 Noto Sans SC 700 | 700 | 概览英雄标题（不换衬线） |

**尺度（概览）**

- 欢迎名：28px / 700 / tracking -0.03em
- 英雄标题：`clamp(40px, 5.4vw, 72px)` / 700 / tracking -0.045em / 行高 1.08 / 最大 16ch
- 叙述：15px / 行高 1.75 / 最大 58ch
- 卡片大数字：52–64px Outfit
- 导航：14px / 500；激活 650
- 标签/胶囊：11–12px / 600 / tracking 0.04em

**底板页**保留原工作面尺度（标题 32–46px），不要把 72px 英雄标题复制到课表。

禁止：全大写英文导航、过度 tracking（>0.16em）、标题用 Noto Serif 做装饰墙（旧 campus-paper 衬线仅可出现在尚未迁移的底板内文，新玻璃面不用）。

---

## 4. Layers — card-based, stacked glass

z 与材料从下到上。**新 UI 必须能指出自己在哪一层。**

| Layer | 名称 | 材料 | z / 形态 |
|---|---|---|---|
| L0 | Atmosphere | 风景照片 + 水彩洗 | `position:fixed; z:0; pointer-events:none` |
| L1 | Shell | 侧栏玻璃柱、浮动圆钮 | 侧栏 `z:5`；圆钮在 topbar |
| L2 | Stage | 概览英雄：无卡片、字直接落在大气层上 | 主栏 |
| L3 | Card | `--glass` 22–26px 圆角卡片 | 右侧栏、非概览 page-sheet |
| L4 | Chip | 更小玻璃：任务胶囊、小时点、标签 | 嵌在 L2/L3 内 |
| L5 | Overlay | 搜索、AI、确认框 | z 35–5000，沿用现有宿主 |

**分层规则**

- L2 只用于概览英雄（标题、叙述、小时带、周曲线）。不要给英雄再套一张大玻璃底板，那会变成「窗户上贴窗户」。
- L3 卡片垂直堆叠，间距 12px；不要用阴影制造假 3D，用叠放与 1px 边。
- L4 不得再套 L4（胶囊里不再放玻璃卡）。
- 非概览路由：L3 升级为整页 **page-sheet**（`background: rgba(255,252,247,.86)` + blur 18px + 24px 圆角），内部组件按浅色工作面绘制。
- 侧栏是独立 L1 柱，`inset: 14px auto 14px 14px`，圆角 26px，不与主栏连成一块实心。

**网格（概览）**

```
[ L1 rail 84|228 ]  [ L2 hero  1fr  |  L3 widgets 260–332 ]
```

主栏 gap 22px。侧栏与主栏间隙 14px（`--nav-w + 28px` 含左侧 inset）。

---

## 5. Glass recipe（复制用）

```css
.glass-l3 {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md); /* 22px */
  background: var(--glass);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(22px) saturate(1.35);
  -webkit-backdrop-filter: blur(22px) saturate(1.35);
  color: var(--glass-text);
}

.glass-l4 {
  border: 1px solid rgba(247, 251, 248, 0.18);
  border-radius: var(--radius-pill);
  background: rgba(247, 251, 248, 0.10);
  backdrop-filter: blur(12px);
}

.glass-icon-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid var(--glass-border);
  background: var(--glass);
  color: var(--glass-text);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(16px);
}
```

Hover：只把 fill 从 0.12 → 0.20，或加 `--glass-strong`。不要放大、不要彩色描边。
Active 导航：fill 0.20 + inset 1px 边。
Disabled：opacity 0.45，不改色相。

---

## 6. Motion

- 侧栏宽：`width` + `margin-left` 0.28s ease。
- 标签显隐：`max-width` 0.24s + `opacity` 0.18s。
- 卡片 hover（底板页）：`translateY(-2px)` 可保留；玻璃页 **禁止** 上浮，只提高不透明度。
- `prefers-reduced-motion: reduce` 时全部 transition 为 none。
- 禁止：无限 pulse、玻璃闪烁、视差滚动、入场超过 400ms 的 cascade。

---

## 7. Components

每个组件给出：用途、结构、token、状态、禁则。实现时优先复用 class，而不是重写。

### 7.1 App shell

- 类：`.app-shell` + `.is-overview` + `.nav-collapsed`
- L0 背景不可点击。
- 概览：主栏文字走玻璃色；非概览：主栏子页面进 page-sheet。

### 7.2 Sidebar

- 展开 228px，收起 84px。圆角 26px，左右 inset 14px。
- Brand：圆形 42px「教」字标 + 两行文案；收起只留标。
- 分组标题 11px / `--glass-subtle`；收起 `max-height:0; overflow:hidden`。
- Nav item：高 44px、圆角 14px；收起变为 48×48、圆角 16px、居中。
- 图标：22px stroke 1.7，`currentColor`，来源 `src/nav-icons.tsx`。
- Badge：收起时变成 8px 陶土圆点；展开时为胶囊数字。
- 底部：收起/展开按钮 + 头像。桌面始终提供收起，窄屏隐藏该按钮、改用「菜单」。
- 禁则：不要汉堡+图标轨同时出现在桌面；不要在收起态露出被裁切的汉字。

### 7.3 Topbar

- 透明、无底边。概览左侧为「欢迎回来」+ `greetingName`；其他路由为面包屑（玻璃淡字）。
- 右侧固定四枚圆钮：**Plus（AI） / Search / Bell / Avatar**。
- Bell 可挂 `.glass-badge`（陶土，9px）。
- 搜索：圆钮打开已有 `GlobalSearchPanel`，输入框在面板内，不要在 topbar 放宽搜索条。
- 窄屏：圆钮 40px；「菜单」玻璃描边按钮出现在左侧。

### 7.4 Welcome block

- 两行：13px subtle「欢迎回来」；28px 姓名。
- 不要再在英雄区重复姓名。

### 7.5 Pill（`.dash-pill`）

- 内容分区标签，如「工作概览」。
- padding 6×12，pill，L4 玻璃。12px / 600。

### 7.6 Hero title + story

- 标题根据当日真实数据生成短句（≤ 10 字）：「今日连堂满课」「实习巡视日」「今日适合备课」。
- 叙述：日期 + 学期周次 + 下一件事。具体名词（教室、课程名）优于形容词。

### 7.7 Hour strip

- 今日日程横向点列，最多 6 个。
- 大数字可用时刻的小时（如 `8` / `14`）或 `08:00`；若用度数符号 `8°` 仅作为概览装饰语言，**其他页面禁止**。
- 次行：种类（课程/值班/截止）；三行：标题 ellipsis。
- 点击跳转日历或截止链接。

### 7.8 Task chips

- L4 胶囊 + checkbox。完成态 opacity 0.55 + 删除线。
- 最多 4 颗；更多去看板。不要在概览做完整任务表。

### 7.9 Week pulse

- 手写 SVG 平滑曲线，描边白 3px + 轻 glow；填充白 0→0.28 纵向渐变。
- 横轴 周一…周六，显示「N 项」。当天高亮为实白。
- 禁止引入 ECharts/Chart.js 重主题；这条线是装饰+导航，不是分析图。

### 7.10 Now card（L3 主卡）

- 头：pin + 地点/班级；右上种类。
- 大数字：下一节时刻（Outfit 64px）或学期周次。
- 三列统计：待办 / 今日课 / 值班，顶部分割线，可点击。
- 截止时可出文字链（下划线、字重 650）。

### 7.11 Place card（课程小卡）

- 左：课名 + 本周主题；右：`{n}周`；下：专业标签（单色）。
- hover：fill 0.18，不上浮。
- 整卡可点进课程。

### 7.12 Page sheet

- 用于 calendar / tasks / courses / students / resources / news / tools / reminders / settings。
- `margin: 0 18px 18px 4px`；圆角 24px；浅瓷白 86% + blur 18px。
- **内部仍用原组件色**（墨字、浅表），不要把课表格子改成白字。
- 任务看板 `overflow:hidden` 时，sheet 必须跟着吃到高度，避免双滚动条打架。

### 7.13 Buttons

| 变体 | 出现位置 | 样式 |
|---|---|---|
| Glass icon | 玻璃舞台 | 46 圆，见 §5 |
| Primary | page-sheet | `--moss-40` 实心，白字，圆角 10px |
| Outline | page-sheet | 1px `--moss-80` 边，浅底 |
| Text action | 两者 | 无边；玻璃上用白 650；底板上用 `--moss-30` |
| Collapse | 侧栏 | 幽灵，14px 圆角 |

禁止在玻璃舞台放实心苔绿大按钮（会像贴纸）。主操作改用圆钮或文字链。

### 7.14 Forms（page-sheet）

- 输入框：浅底、`--moss-80` 边、圆角 10px；focus 用苔色 3px 外光 `--moss-90`，不要蓝色系统光。
- 玻璃 overlay 内（搜索、AI）：透明底、白字、底边分割，不要白底输入框破坏面板。

### 7.15 Badge / Major tag

- 数量：陶土洗，全产品唯一暖色。
- 专业：单色苔阶，紧凑 11px。概览上强制白字 + `--glass-strong` 底。

### 7.16 Empty

- 一句人话 + 一个文字链。「今天暂无日程，可在日历中添加。」不要插画吉祥物。

### 7.17 Overlay

- 搜索：右上对齐圆钮，宽 ≤ 520px，深苔玻璃 `rgba(28,40,34,.72)` + blur 24px。
- AI 面板：可保持现有右下卡片；若改玻璃，用 L5 深苔玻璃，不要浅色纸。
- Confirm / Notify：可暂留原浅色，以免破坏可读性；新做时用 L5 深苔 + 白字。

### 7.18 Data table / calendar（sheet 内）

- 保持工作面密度。格子用 `--moss-95` 与 `--moss-90` 线。
- 事件色：全部改成苔阶明度 + 左边 3px `--moss-40`；截止用灰陶左边，而不是饱和红底。

---

## 8. Iconography

- 语言：细线、圆角端、2px 以内、视口 24。
- 颜色：`currentColor`，随文字层级走。
- 导航映射见 `src/nav-icons.tsx`（overview / calendar / tasks / reminders / courses / students / resources / news / tools / settings / plus / search / bell / pin …）。
- 新增图标必须加到该文件，禁止再引入 emoji 或 Fluent 彩色图标。

---

## 9. Temperament mapping

**默认**就是本系统（approachable luxury + sage glass）。仅当内容气质明确偏离「校园日常」时，在**同一色相**内微调，不换设计系统。

| 内容气质 | 风格标签 | 允许的偏移 | 禁止 |
|---|---|---|---|
| 日常教学、概览、日程、值班 | Approachable luxury + landscape glass | 默认全开：风景、英雄字、L3 卡片 | 商务蓝、办公插画 |
| 科技 / AI / 工具箱 | Futuristic minimalism + glassmorphism | 风景叠洗更冷（提高 `--wash-ink`）、圆角收到 16–20px、网格更准、数字更 Outfit、少用田野暖黄 | 霓虹青、电路纹理、黑镜 |
| 课程档案 / 资源 | Editorial academic | sheet 内字号层级拉大，卡片留白 +1 | 杂志花体、大衬线墙 |
| 学生与评价 | Humane, close | 状态用灰陶/枯叶；列表行高 1.6 | 游戏化徽章彩虹 |
| 资讯 | Quiet editorial | 标题 20–24px，摘要 14px，少卡多列表 | 门户红黄条 |
| 设置 / 备份 | Utilitarian quiet | 几乎不露风景，sheet 铺满，表单密度高 | 英雄标题、大数字展示 |

科技气质的正确理解：**同一块苔色玻璃，光线更冷、边更利、装饰更少**——不是换一套赛博配色。

---

## 10. Page recipes

### Overview（已落地，对照标准）

1. L0 风景 + 洗  
2. L1 可收起侧栏  
3. Topbar 欢迎 + 四圆钮  
4. L2 英雄（pill / 标题 / 叙述 / 小时 / 任务芯片 / 周曲线）  
5. L3 右侧 Now + 三张课程小卡  

数据必须真实：`todayIso()`、课程 `weeklyTopics`、任务状态。禁止写死「周一示例」。

### Other routes

壳层与概览相同；内容进 page-sheet。迁移某一页到「全玻璃」前，先出该页 recipe，再改组件，禁止半页白字半页墨字。

---

## 11. Copy

- 称呼用 `profile.greetingName`（如「李明华老师」）。
- 按钮动词：进入看板、全部日程、收起菜单。不要「立即体验」。
- 空状态说明下一步。
- 数字用阿拉伯数字 + 中文单位（9 周、3 今日课）。

---

## 12. Accessibility

- 收起侧栏：每个 `nav-item` 必须有 `aria-label` 与 `title`。
- 收起/展开：`aria-expanded`。
- 焦点：玻璃圆钮 `focus-visible` 用 2px `--mist` outline + 2px offset，不要浏览器默认蓝。
- 动画尊重 `prefers-reduced-motion`。
- 触控目标 ≥ 44px（收起轨 48px）。

---

## 13. File map

| 文件 | 职责 |
|---|---|
| `src/glass.css` | 壳层、侧栏、topbar、page-sheet、搜索玻璃 |
| `src/dashboard.css` | 概览英雄与卡片 |
| `src/nav-icons.tsx` | 线描图标 |
| `src/App.tsx` | 收起状态、`is-overview`、圆钮 |
| `src/pages/Dashboard.tsx` | 概览结构与文案生成 |
| `public/glass-sky.jpg` | L0 风景 |
| `src/theme.css` | 旧 campus-paper token；新玻璃面不要再加旧强调色 |
| `docs/design-prompts/` | LLM 提示词包 |

改视觉时：**先改 token，再改组件，最后改页面。** 禁止在 JSX 写死 `rgba(255,255,255,.12)` 的平行值，应落回变量。

---

## 14. QA checklist（实现后自测）

- [ ] 只有一条色相；截图去饱和后，结构仍靠明度分层可读。
- [ ] 玻璃元素 ≤ 3 层嵌套；英雄区没有整块底板。
- [ ] 侧栏可收起，收起后无残字；刷新后状态仍在。
- [ ] 概览四圆钮都能用（AI / 搜索 / 提醒 / 设置）。
- [ ] 非概览页正文是墨色，不是白字叠风景。
- [ ] 无 Inter、无紫渐变、无 emoji 导航。
- [ ] 今日标题与时段来自真实 `events`，不是占位。
- [ ] `prefers-reduced-motion` 下无位移动画。

---

## 15. Anti-references

不要学：Linear 紫黑、Glassmorphism 教程里的白卡片墙、教务系统蓝表头、Material 3 默认紫。

要对齐的感觉：天气类玻璃舞台的**材料与构图** + 莫兰迪静物的**灰度** + 手工纸的**薄涂** + 高校教师的**日常用词**。
