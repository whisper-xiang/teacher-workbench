# 04 · Temperament shift

内容气质变化时用。不换设计系统，只在同一苔色相内偏移。先贴 `00-system.md`。

```
任务：把 {{SURFACE}} 的气质从 {{FROM}} 调到 {{TO}}。
允许改：叠洗明度、圆角、字号层级、装饰量、网格松紧。
禁止改：色相、字体家族、layer 模型、侧栏结构、token 名称。

映射（DESIGN.md §9）：
- daily：风景暖一点（保留现有 glass-sky + wash-ink/fog/mid），英雄字大，L3 卡片 22px。
- futurist-glass：提高 --wash-ink；减弱田野暖黄；圆角 16–20px；更细的 1px 边；去掉水彩径向暖洗；仍用 sage 玻璃 fill。不换字体。
- editorial：sheet 内标题层级拉开，列表优于宫格。
- humane：状态色只用灰陶/枯叶/苔；行高 1.6；少图表。
- quiet-util：几乎全 sheet，无英雄、无大数字展示。

请先用 5 行说明「改什么 / 不改什么」，再改代码。若 {{TO}} 需要新色相，拒绝并说明。
```

## 槽位示例

```
SURFACE = #/tools 工具箱页
FROM = daily
TO = futurist-glass
```
