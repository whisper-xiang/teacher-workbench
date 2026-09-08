# 01 · Page generation / redesign

用于新页面或把某路由迁到玻璃体系。先贴 `00-system.md`，再贴本块。

```
任务：为路由 {{ROUTE_ID}} 设计并实现页面 UI。
页面目的：{{PURPOSE}}
主要数据（只读现有模型）：{{DATA_SHAPES}}
用户完成的关键动作：{{PRIMARY_ACTIONS}}

气质（从 DESIGN.md §9 选一个，默认 daily）：{{TEMPERAMENT}}
  - daily = 概览同款风景玻璃（仅 overview 或明确要求的沉浸页）
  - futurist-glass = 科技/AI/工具，冷洗、几何、同一苔色
  - editorial = 课程/资源
  - humane = 学生与评价
  - quiet-util = 设置

约束：
1. 若不是 overview：必须使用 page-sheet，正文墨色，不要白字直接写在风景上。
2. 卡片分层：列出本页每个区块的 layer（L0–L5）。英雄大底板禁止出现在 sheet 页。
3. 配色只用 DESIGN.md §2 token。专业标签单色苔阶。
4. 侧栏/topbar 不重做，只消费 App shell。
5. 空状态、错误、少数据都要画。
6. 对照 DESIGN.md §14 自测后才结束。

交付：
- 改动的文件列表
- 本页 layer 结构（3–8 行）
- 实现代码
- 与 DESIGN.md 不符之处必须显式声明，否则视为缺陷
```

## 槽位示例

```
ROUTE_ID = tools
PURPOSE = 让老师在预置教育学工具里收藏与打开链接
DATA_SHAPES = ToolItem[] + favoriteTools: string[]
PRIMARY_ACTIONS = 搜索、按分类筛选、收藏、打开
TEMPERAMENT = futurist-glass
```
