# Design Prompt Pack

供大语言模型使用。与 `docs/DESIGN.md` **一起**提供；本目录是指令，DESIGN.md 是法律。

## 用法

1. 把 `docs/DESIGN.md` 全文放入上下文（或声明「严格遵守仓库 docs/DESIGN.md」且该文件已在上下文中）。
2. 按任务选一条提示词，填 `{{SLOT}}`。
3. 生成后用 `03-critique.md` 再跑一轮，不要跳过。
4. 科技/AI 页先读 DESIGN.md §9，再使用 `04-temperament.md`。

| 文件 | 何时用 |
|---|---|
| [00-system.md](./00-system.md) | 任何 UI 任务的系统前缀 |
| [01-page.md](./01-page.md) | 新页面或整页改版 |
| [02-component.md](./02-component.md) | 单组件 / 局部改样式 |
| [03-critique.md](./03-critique.md) | 审查已有实现或截图 |
| [04-temperament.md](./04-temperament.md) | 按内容气质微调（默认 vs 科技玻璃等） |
| [05-tokens.md](./05-tokens.md) | 只改色板 / CSS 变量 / 不允许发明新色相 |

## 硬约束（可复制到任何对话顶部）

```
遵守 docs/DESIGN.md。
哲学：approachable luxury。
色彩：Morandi sage 单色 + watercolor wash。色相锁 152°±6°。
布局：card-based + layered（L0 大气层 … L5 overlay）。
概览用风景玻璃；其他路由用 page-sheet，墨字。
禁止：紫渐变、Inter、emoji 导航、霓虹赛博、玻璃嵌套超过 3 层。
复用 src/glass.css、src/nav-icons.tsx、现有数据模型；禁止平行造色或平行造数据。
```
