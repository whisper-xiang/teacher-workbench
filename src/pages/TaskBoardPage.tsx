import { useRef, useState } from 'react'
import { uid } from '../data/store'
import { MajorFilter, MajorTag } from '../components/MajorTag'
import type { BoardPriority, BoardStatus, BoardTask, MajorId } from '../data/types'
import { notify } from '../lib/notify'
import { isTaskOverdue, nextPriority } from '../lib/tasks'

const boardColumns: { id: BoardStatus; title: string; icon: string }[] = [
  { id: 'todo', title: '待办', icon: '📥' },
  { id: 'doing', title: '进行中', icon: '🔄' },
  { id: 'review', title: '待审核', icon: '🔍' },
  { id: 'done', title: '已完成', icon: '✅' },
]

const priorityLabel: Record<BoardPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const emptyForm = {
  id: '',
  title: '',
  course: '',
  due: '本周五',
  dueDate: '',
  kind: '教学' as BoardTask['kind'],
  priority: 'medium' as BoardPriority,
  status: 'todo' as BoardStatus,
  desc: '',
  assignee: '本人',
  major: '' as MajorId | '',
}

type Props = {
  tasks: BoardTask[]
  onChange: (tasks: BoardTask[]) => void
}

export function TaskBoardPage({ tasks, onChange }: Props) {
  const [filter, setFilter] = useState<'全部' | BoardTask['kind']>('全部')
  const [major, setMajor] = useState<MajorId | '' | 'general'>('')
  const [query, setQuery] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<BoardStatus | null>(null)
  const [form, setForm] = useState(emptyForm)
  const dragMoved = useRef(false)
  const columnRefs = useRef<Partial<Record<BoardStatus, HTMLElement | null>>>({})

  const editing = Boolean(form.id)

  const visibleTasks = tasks.filter((task) => {
    if (filter !== '全部' && task.kind !== filter) return false
    if (major === 'general' && task.major) return false
    if (major && major !== 'general' && task.major !== major) return false
    return `${task.title}${task.course}${task.desc ?? ''}${task.assignee ?? ''}`.includes(query.trim())
  })

  const counts = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    doing: tasks.filter((t) => t.status === 'doing').length,
    review: tasks.filter((t) => t.status === 'review').length,
    done: tasks.filter((t) => t.status === 'done').length,
  }


  const moveTask = (id: string, status: BoardStatus) => {
    const item = tasks.find((task) => task.id === id)
    if (!item || item.status === status) return
    onChange(tasks.map((task) => (task.id === id ? { ...task, status } : task)))
    notify.success(`已将「${item.title}」移至${boardColumns.find((column) => column.id === status)?.title}`)
  }

  const cyclePriority = (id: string) => {
    const item = tasks.find((task) => task.id === id)
    if (!item) return
    const priority = nextPriority(item.priority)
    onChange(tasks.map((task) => (task.id === id ? { ...task, priority } : task)))
    notify.info(`「${item.title}」优先级已改为${priorityLabel[priority]}`)
  }

  const openCreate = (status: BoardStatus = 'todo') => {
    setForm({ ...emptyForm, status })
    setComposerOpen(true)
  }

  const openEdit = (task: BoardTask) => {
    setForm({
      id: task.id,
      title: task.title,
      course: task.course,
      due: task.due,
      dueDate: task.dueDate ?? '',
      kind: task.kind,
      priority: task.priority ?? 'medium',
      status: task.status,
      desc: task.desc ?? '',
      assignee: task.assignee ?? '本人',
      major: task.major ?? '',
    })
    setComposerOpen(true)
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setForm(emptyForm)
  }

  const saveTask = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return
    const next: BoardTask = {
      id: form.id || uid('task'),
      title: form.title.trim(),
      course: form.course.trim() || '未关联课程',
      due: form.due.trim() || '待定',
      dueDate: form.dueDate || undefined,
      kind: form.kind,
      priority: form.priority,
      status: form.status,
      desc: form.desc.trim() || undefined,
      assignee: form.assignee.trim() || '本人',
      major: form.major || null,
    }
    onChange(form.id ? tasks.map((task) => (task.id === form.id ? next : task)) : [...tasks, next])
    notify.success(form.id ? `已更新：${next.title}` : `已创建并保存：${next.title}`)
    closeComposer()
  }

  const removeTask = () => {
    if (!form.id) return
    const title = form.title.trim() || '任务'
    if (!window.confirm(`确定删除「${title}」？`)) return
    onChange(tasks.filter((task) => task.id !== form.id))
    notify.warning(`已删除：${title}`, '已删除')
    closeComposer()
  }

  const scrollToColumn = (status: BoardStatus) => {
    columnRefs.current[status]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  return (
    <section className="task-board" aria-label="教学看板">
      <div className="page-actions">
        <button className="primary-action board-add" onClick={() => openCreate()}>
          ＋ 新建任务
        </button>
      </div>

      <section className="board-summary kanban-status-summary" aria-label="看板状态概览">
        {boardColumns.map((column) => (
          <button
            type="button"
            className="kanban-summary-item kanban-summary-btn"
            key={column.id}
            onClick={() => scrollToColumn(column.id)}
          >
            <span className={`kanban-column-dot ${column.id}`} aria-hidden="true" />
            <div>
              <strong className="summary-number">{counts[column.id]}</strong>
              <span>{column.title}</span>
            </div>
          </button>
        ))}
        <p className="board-summary-note">共 {tasks.length} 个任务 · 支持拖拽移动</p>
      </section>

      <div className="board-controls">
        <MajorFilter value={major} onChange={setMajor} includeGeneral />
        <div className="board-filter" aria-label="任务类型筛选">
          {(['全部', '教学', '学生', '教务', '教研'] as const).map((item) => (
            <button className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)} key={item}>
              {item}
            </button>
          ))}
        </div>
        <label className="board-search">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务、负责人或课程" />
        </label>
      </div>

      <div className="kanban-grid">
        {boardColumns.map((column) => {
          const columnTasks = visibleTasks.filter((task) => task.status === column.id)
          return (
            <section
              className={`kanban-column column-${column.id}${dragOverCol === column.id ? ' drag-over' : ''}`}
              key={column.id}
              ref={(node) => {
                columnRefs.current[column.id] = node
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOverCol(column.id)
              }}
              onDragLeave={() => setDragOverCol((current) => (current === column.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault()
                setDragOverCol(null)
                moveTask(event.dataTransfer.getData('text/task-id'), column.id)
              }}
            >
              <header>
                <div className="kanban-column-title">
                  <span className={`kanban-column-dot ${column.id}`} aria-hidden="true" />
                  <span aria-hidden="true">{column.icon}</span>
                  <h2>{column.title}</h2>
                </div>
                <b>{columnTasks.length}</b>
              </header>
              <div className="kanban-stack">
                {columnTasks.map((task) => {
                  const priority = task.priority ?? 'low'
                  const overdue = isTaskOverdue(task)
                  return (
                    <article
                      className={`task-card priority-${priority}${draggingId === task.id ? ' dragging' : ''}${overdue ? ' is-overdue' : ''}`}
                      draggable
                      onDragStart={(event) => {
                        dragMoved.current = false
                        event.dataTransfer.setData('text/task-id', task.id)
                        event.dataTransfer.effectAllowed = 'move'
                        setDraggingId(task.id)
                      }}
                      onDrag={() => {
                        dragMoved.current = true
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDragOverCol(null)
                      }}
                      onClick={() => {
                        if (dragMoved.current) return
                        openEdit(task)
                      }}
                      key={task.id}
                    >
                      <div className="task-card-top">
                        <div className="task-card-meta">
                          <span className={`kind-tag kind-${task.kind}`}>{task.kind}</span>
                          <MajorTag major={task.major} compact />
                          <span className="assignee-tag">{task.assignee || '本人'}</span>
                        </div>
                        <button
                          type="button"
                          className={`priority-chip priority-chip-${priority}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            cyclePriority(task.id)
                          }}
                          title="点击切换优先级"
                        >
                          {priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢'} {priorityLabel[priority]}
                        </button>
                      </div>
                      <h3>{task.title}</h3>
                      <p className="task-desc">{task.desc || task.course}</p>
                      {task.desc && task.course ? <p className="task-course">{task.course}</p> : null}
                      <div className="task-card-footer">
                        <span className={overdue || priority === 'high' ? 'due urgent-due' : 'due'}>
                          {overdue ? '逾期 · ' : '⏰ '}
                          {task.due}
                        </span>
                        <span className="task-edit-hint">点击编辑</span>
                      </div>
                    </article>
                  )
                })}
                {columnTasks.length === 0 && <div className="empty-column">暂无匹配任务</div>}
              </div>
              <button className="column-add" onClick={() => openCreate(column.id)}>
                ＋ 添加任务
              </button>
            </section>
          )
        })}
      </div>

      {composerOpen && (
        <div className="board-modal-backdrop" onMouseDown={closeComposer}>
          <form className="board-composer" onSubmit={saveTask} onMouseDown={(event) => event.stopPropagation()}>
            <div className="composer-heading">
              <div>
                <p className="section-label">{editing ? '编辑任务' : '新建任务'}</p>
                <h2>{editing ? '更新看板任务' : '添加到教学看板'}</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeComposer} aria-label="关闭">
                ×
              </button>
            </div>
            <label>
              任务名称
              <input
                autoFocus
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="例如：完成课程教案"
                required
              />
            </label>
            <label>
              说明
              <input
                value={form.desc}
                onChange={(event) => setForm({ ...form, desc: event.target.value })}
                placeholder="补充任务细节（可选）"
              />
            </label>
            <label>
              关联课程或事项
              <input
                value={form.course}
                onChange={(event) => setForm({ ...form, course: event.target.value })}
                placeholder="例如：教育心理学 · 2024-1 班"
              />
            </label>
            <div className="composer-grid">
              <label>
                负责人
                <input
                  value={form.assignee}
                  onChange={(event) => setForm({ ...form, assignee: event.target.value })}
                  placeholder="本人 / 教务处 / 教研室"
                />
              </label>
              <label>
                关联专业
                <select
                  value={form.major}
                  onChange={(event) => setForm({ ...form, major: event.target.value as MajorId | '' })}
                >
                  <option value="">通用</option>
                  <option value="edu">教育学</option>
                  <option value="pri">小学教育</option>
                  <option value="pre">学前教育</option>
                </select>
              </label>
            </div>
            <div className="composer-grid">
              <label>
                截止说明
                <input value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} placeholder="今天 17:00" />
              </label>
              <label>
                截止日期
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                />
              </label>
            </div>
            <div className="composer-grid">
              <label>
                优先级
                <select
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value as BoardPriority })}
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </label>
              <label>
                任务类型
                <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as BoardTask['kind'] })}>
                  {(['教学', '学生', '教务', '教研'] as const).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              看板状态
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BoardStatus })}>
                {boardColumns.map((column) => (
                  <option value={column.id} key={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            </label>
            <div className={`composer-actions${editing ? ' composer-actions-split' : ''}`}>
              {editing && (
                <button type="button" className="danger-action" onClick={removeTask}>
                  删除任务
                </button>
              )}
              <div className="composer-actions-right">
                <button type="button" className="outline-action" onClick={closeComposer}>
                  取消
                </button>
                <button type="submit" className="primary-action">
                  {editing ? '保存修改' : '创建并保存'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
