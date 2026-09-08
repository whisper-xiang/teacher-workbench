# 02 · Component

用于单个组件或局部样式。先贴 `00-system.md`。

```
任务：实现或改版组件 {{COMPONENT_NAME}}。
出现在：{{SURFACE}}   （glass-stage | page-sheet | overlay）
变体：{{VARIANTS}}
状态：default / hover / active / disabled / empty / error（按需）
数据：{{PROPS}}

规则：
1. SURFACE=glass-stage → 白字 + §5 玻璃配方；hover 只改变不透明度，不上浮。
2. SURFACE=page-sheet → 墨字 + moss token；主按钮 moss-40。
3. SURFACE=overlay → 深苔玻璃 rgba(28,40,34,.72) + 白字。
4. 圆角：芯片 pill；卡片 22px；sheet 24px；侧栏 26px；圆钮 50%。
5. 图标必须是 src/nav-icons.tsx 的线描；没有则先加图标再引用。
6. 单色：不要为状态引入蓝/紫/亮红。危险用 #8f5b50，警告用 #9a7b56，成功用 --moss-40。
7. 嵌套：L4 内禁止再放 L3。
8. 无障碍：可点击目标 ≥ 44px；icon-only 必须 aria-label。

交付：TSX + CSS（变量优先）+ 在哪种 layer。只改这一组件的必要文件。
```

## 槽位示例

```
COMPONENT_NAME = DeadlineChip
SURFACE = glass-stage
VARIANTS = pending | done
PROPS = title, dueLabel, onOpen, onComplete
```
