# UI 优化任务（逐页）

对照 `docs/DESIGN.md`。原则：**先公共底座，再按路由吃掉彩虹色与旧纸面；非概览页一律停在 page-sheet，不把整页改成白字风景。**

体量：小 ≈ 0.5–2h · 中 ≈ 半天 · 大 ≈ 1 天。  
提示词：底座用 `05-tokens.md`；整页用 `01-page.md`；收尾用 `03-critique.md`。

---

## 建议顺序

| 波次 | 范围 | 为什么先做 |
|---|---|---|
| 0 | 色板 + 专业标签 + 壳层 | 后面每页都吃同一套 token，否则会返工 |
| 1 | 概览收口 | 设计标杆，已有 80%，补齐即可 |
| 2 | 日程 → 看板 → 提醒 | 老师每天用，且事件/优先级色最花 |
| 3 | 课程 → 学生 → 资源 | 教学主路径，气质 editorial / humane |
| 4 | 资讯 → 工具箱 | 气质偏移（editorial / futurist-glass） |
| 5 | 设置 + Overlay | 安静收尾；AI/通知/确认框 |

未完成波次 0 时，不要开波次 3 以后的「全页视觉重做」。

---

## 波次 0 · 公共底座（所有页依赖）

**气质**：—  
**文件**：`src/theme.css` `src/glass.css` `src/majors.css` `src/index.css` `index.html`

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| F-1 | ✅  把 DESIGN.md §2 的 `--moss-*` `--glass-*` `--wash-*` 写入 `:root`，旧 `--accent` 映射到 `--moss-40`，消灭平行绿 | 中 | 新样式只引用变量；对照表写在 PR/提交说明 |
| F-2 | ✅  L0 大气层改成「照片 × 三层 wash」（ink / sage 径向 / fog），不再只用一块死渐变 | 小 | 白字对比仍够；无照片时 `--moss-20` 垫底 |
| F-3 | ✅  `MajorTag` 改为苔阶明度差（edu/pri/pre/通），去掉蓝/青绿/紫 | 小 | 概览与 sheet 内标签都单色；文字仍能区分专业 |
| F-4 | ✅  page-sheet：看板双滚动、圆角裁切、窄屏 margin；focus-visible 用雾白/苔色，去掉系统蓝光 | 中 | 9 个非概览路由打开都不「漏风景吃字」 |
| F-5 | 搜索面板、AI 面板改 L5 深苔玻璃（可本波只做搜索，AI 放到波次 5） | 中 | overlay 内输入框透明底白字 |

**不做**：把课表/成绩改成白字玻璃（§7.12）。

---

## 1. 工作概览 `#/overview`

**气质**：daily · landscape glass（标杆页，已落地骨架）  
**文件**：`src/pages/Dashboard.tsx` `src/dashboard.css` `src/glass.css`

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| OV-1 | ✅ 小时带去掉天气梗 `8°`，改为 `08:00` / Outfit 小时，截止显示「截止」不是第二个 8 点 | 小 | 老师能一眼读成时刻 |
| OV-2 | ✅ 课程小卡专业标签走 F-3；hover 只提高 fill，不上浮 | 小 | 无蓝紫标签 |
| OV-3 | ✅ 内联 `rgba` 收到 F-1 变量；删掉不再使用的旧 `.overview-banner` 规则 | 小 | dashboard.css 无死代码 |
| OV-4 | ✅ 空日程 / 无课程 / 无待办三条空态按 §7.16 | 小 | 各有一句人话 + 跳转 |
| OV-5 | ✅ 窄屏：小时带可横滑、周曲线不被裁切、右侧卡在英雄之下单列 | 中 | 390px 可滚完所有块 |

提示词：`01-page.md` temperament=`daily`（仅收口，不重做布局）。

---

## 2. 日程与值班 `#/calendar`

**气质**：daily · 工作面密度 6–7，sheet 内  
**文件**：`src/pages/CalendarPage.tsx` `src/calendar.css` `src/theme.css` `src/majors.css`

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| CA-1 | ✅ 页头压进 sheet：去掉旧 48px 大 padding 与纸面 max-width，标题 28–32px 级 | 中 | 与壳层圆钮不打架 |
| CA-2 | ✅ 事件色单色化：课程/值班/会议/巡视 = 苔阶 + 左 3px `--moss-40`；截止 = `#8f5b50` 左边，禁止 `#dc2626` 底 | 中 | 月视图/周视图/当日列表一致 |
| CA-3 | ✅ `kind-badge`、值班类型（上课/巡查/访校）去掉蓝紫黄彩虹 | 小 | 只靠文案 + 苔阶 |
| CA-4 | ✅ 新建/编辑日程弹层：圆角 22、moss 边、主按钮 `--moss-40` | 中 | 无系统蓝 focus |
| CA-5 | ✅ 当日空态：「这一天暂无安排」保留，补文字链「新建日程」 | 小 | §7.16 |
| CA-6 | ✅ 周视图时间轴线色改 `--moss-90`，今日高亮用 wash 而不是高饱和绿块 | 小 | |

依赖：F-1、F-3。  
提示词：`01-page.md` temperament=`daily`。

---

## 3. 教学看板 `#/tasks`

**气质**：daily，略偏工作台  
**文件**：`src/pages/TaskBoardPage.tsx` `src/task-board.css` `src/theme.css`

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| TB-1 | ✅  sheet 高度吃满：列内滚动、外层不双滚动（§7.12） | 中 | 桌面三列可见底 |
| TB-2 | ✅  优先级左边：高 `#8f5b50`、中 `#9a7b56`、低 `--moss-40`；去掉红橙绿 | 小 | |
| TB-3 | ✅  `kind-教学/学生/教务/教研` 标签改苔阶，去掉紫/蓝 | 小 | |
| TB-4 | ✅  卡片 hover 禁止 translateY（玻璃体系；sheet 内最多 1px 边变深） | 小 | |
| TB-5 | ✅  新建任务弹层、右键菜单：L5 深苔或浅瓷二选一，但不要半透明白糊在风景上 | 中 | 右键不「漏底」 |
| TB-6 | ✅  逾期态用灰陶字重，不用亮红满底 | 小 | |

依赖：F-1、F-4。  
提示词：`01-page.md` temperament=`daily`。

---

## 4. 通知提醒（已并入 `#/calendar`）

**气质**：daily，表单偏多  
**文件**：`src/pages/CalendarPage.tsx` `src/calendar.css`

独立路由 `#/reminders` 已移除，能力并入日程：月/周视图展示、当日列表管理、自然语言解析、系统通知。旧地址重定向到 `#/calendar`。

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| RM-1 | ✅  页头 + Tab（手动 / 自然语言）收成 sheet 内分段控件，选中态 moss-40 而不是旧青绿胶囊 | 中 | |
| RM-2 | ✅  待办列表卡：状态点用苔/陶土；fired 用 subtle，不用大红 | 小 | |
| RM-3 | ✅  自然语言预览卡做成 L4 浅瓷，确认按钮 primary moss | 小 | 与概览「具体短句」一致 |
| RM-4 | ✅  系统通知权限条：警告用枯叶 `#9a7b56`，不要黄底 banner | 小 | |
| RM-5 | ✅  空列表：「还没有提醒，可以说『明天 8 点提醒带教案』」 | 小 | |
| RM-6 | ✅ 2026-09-10 并入日程页，侧栏不再单列「通知提醒」 | 中 | `#/reminders` 进入日历；铃铛打开当日/下一条提醒 |

依赖：F-1。  
提示词：`01-page.md` temperament=`daily`。

---

## 5. 课程与排课 `#/courses`

**气质**：editorial academic  
**文件**：`src/pages/CoursesPage.tsx` `src/courses.css` `src/majors.css`

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| CO-1 | ✅  页头层级：kicker「教学管理」+ 标题 + 一句 lead；标题不超过 32px | 小 | 不像营销落地页 |
| CO-2 | ✅  课程卡：留白 +1、进度条 `--moss-30→60`、状态（正常/待更新/需关注）= 苔/枯叶/灰陶 | 中 | 无彩色 status pill |
| CO-3 | ✅  周课表格子 `week-slot.edu/pri/pre` 改为苔阶，禁止蓝/米色三色专业格 | 中 | 仍能看出不同课（靠课名） |
| CO-4 | ✅  编辑档案弹层：表单 §7.14；周主题 textarea 行高 1.6 | 中 | |
| CO-5 | ✅  空课程：「还没有课程，先建一门课再排时段」 | 小 | |
| CO-6 | ✅  右键菜单与看板同一套 overlay 皮肤 | 小 | 跟 TB-5 共用更好 |

依赖：F-1、F-3。  
提示词：`01-page.md` temperament=`editorial`。

---

## 6. 学生与评价 `#/students`

**气质**：humane  
**文件**：`src/pages/StudentsPage.tsx` `src/students.css` `src/majors.css`

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| ST-1 | ✅  列表行高 1.6；关注/待跟进用枯叶/灰陶，不用红底学生行 | 中 | 读花名册不焦虑 |
| ST-2 | ✅  总评 `letter-badge` A–F：成功=苔、中=枯叶、D/F=灰陶；去掉蓝/亮绿/亮红 | 中 | |
| ST-3 | ✅  成绩分布条、课程条：单色 moss 渐变，禁止青绿 `#38b2ac` | 小 | |
| ST-4 | ✅  作业批改、花名册导入弹层：表单 token + 人话空态 | 中 | |
| ST-5 | ✅  Tab（名册 / 作业 / 成绩）选中态 moss，不要旧青绿描边 | 小 | |
| ST-6 | ✅  无学生：「先选课程，粘贴名单即可」 | 小 | |

依赖：F-1、F-3。  
提示词：`01-page.md` temperament=`humane`。  
**注意**：P2-1 成绩 CSV 导出是产品功能，不在本视觉任务内。

---

## 7. 教学资源库 `#/resources`

**气质**：editorial academic  
**文件**：`src/pages/ResourcesPage.tsx` `src/resources.css`

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| RS-1 | ✅  资源卡去彩色 accent 条，改 1px moss 边 + 类型文字；类型不用五色点 | 中 | |
| RS-2 | ✅  筛选/搜索 focus 苔色；课程筛选与 F-3 一致 | 小 | |
| RS-3 | ✅  拖拽上传区：虚线 `--moss-70` + wash-fog，拖入时 fill 加深，不要蓝虚线 | 中 | |
| RS-4 | ✅  预览/编辑弹层 round 22、主按钮 moss | 中 | |
| RS-5 | ✅  空库：「还没有资源，可从课程卡进来补传」 | 小 | |

依赖：F-1。  
提示词：`01-page.md` temperament=`editorial`。

---

## 8. 热点资讯 `#/news`

**气质**：quiet editorial  
**文件**：`src/pages/NewsPage.tsx` `src/news.css`

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| NW-1 | ✅  去掉三等分 overview 指标卡的「仪表盘感」，改成一行数字 + 列表为主 | 中 | §0 禁止三等分功能卡 |
| NW-2 | ✅  `category-teal/blue/amber…` 全部改为苔阶或纯文字分类 | 中 | 无门户红黄条、无彩虹分类 |
| NW-3 | ✅  列表标题 20–24px、摘要 14px、来源 subtle；已读降低不透明度 | 中 | |
| NW-4 | ✅  「热」标改枯叶字，不要黄底小条 | 小 | |
| NW-5 | ✅  空/刷新失败人话：「没拉到资讯，检查网络后再试」 | 小 | |

依赖：F-1。  
提示词：`01-page.md` temperament=`editorial`（资讯行）。

---

## 9. 工具箱 `#/tools`

**气质**：futurist-glass（同一苔色，更冷更利）  
**文件**：`src/pages/ToolsPage.tsx` `src/tools.css`

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| TL-1 | ✅  分类 emoji（🏛️📚🤖）换成 `nav-icons` 线描 | 中 | §0 NEVER emoji 导航/分类 |
| TL-2 | ✅  气质偏移：sheet 内圆角 16–20、细边、少暖黄；**不**换青霓虹 | 中 | 用 `04-temperament.md` |
| TL-3 | ✅  工具卡网格对齐、收藏星标 currentColor，不要金黄星 | 小 | |
| TL-4 | ✅  分类描述用 12px subtle，不要大色块 icon 底 | 小 | |
| TL-5 | ✅  新增/编辑弹层与全局 overlay 皮肤一致 | 小 | |

依赖：F-1、F-4。  
提示词：`04-temperament.md` FROM=daily TO=futurist-glass。

---

## 10. 设置与备份 `#/settings`

**气质**：quiet-util  
**文件**：`src/pages/SettingsPage.tsx` `src/settings.css`

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| SE-1 | ✅  去掉任何英雄/大数字；表单密度提高，分组用 11px kicker | 中 | 像器物说明书，不像运营页 |
| SE-2 | ✅  输入/select 走 §7.14；保存 = primary moss | 小 | |
| SE-3 | ✅  危险操作（重置）：灰陶描边 + 确认框，不要大红满按钮 | 小 | |
| SE-4 | ✅  导出/导入：outline 按钮一排；演示对齐不再放在设置页 | 小 | |
| SE-5 | ✅  设置收成我 / 学期 / 桌宠 / 本机；称呼自动、照片一键生成、PWA 说明去掉 | 中 | 功能少而闭环，改完即存 |

依赖：F-1。  
提示词：`01-page.md` temperament=`quiet-util`。

---

## 11. 全局 Overlay（不算路由，但每页都会撞上）

**文件**：`src/components/AiAssistantPanel.tsx` `NotifyHost` `ConfirmHost` `GlobalSearchPanel` + 对应 css

| ID | 任务 | 体量 | 验收 |
|---|---|---|---|
| OX-1 | 搜索：已有玻璃皮，收 token、kbd、结果行 hover | 小 | 可并进 F-5 |
| OX-2 | AI 面板：L5 深苔玻璃、气泡 moss、草稿卡浅瓷 | 中 | 科技气质但不霓虹 |
| OX-3 | Confirm / Notify：新做则深苔+白字；暂留浅色也可以，但边色改 moss、成功态不要亮绿 | 中 | 可读优先 |

建议：OX-1 跟波次 0；OX-2/3 跟波次 5。

---

## 明确不做（本清单范围外）

- 多用户、云同步、直连教务（PRD 非目标）
- 把 calendar/students 整页改成风景白字（须先单独写 recipe）
- 成绩 CSV 导出（产品 P2-1，不是视觉）
- 换背景图风格实验、动效库、图表库

---

## 每页开工模板

1. 贴 `docs/design-prompts/00-system.md`  
2. 贴对应 `01-page.md` 或 `02-component.md`，填路由与气质  
3. 只改该页 css + 必要 TSX，不顺手重做邻页  
4. 浏览器走主路径 + 空态 + 弹层  
5. 用 `03-critique.md` 过一遍再标完成  

完成某页后在本文件对应表打勾，并在提交说明写：`ui(页码): …`。
