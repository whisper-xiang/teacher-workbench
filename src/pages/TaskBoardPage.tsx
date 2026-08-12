import { useEffect, useRef, useState } from 'react'
import { uid } from '../data/store'
import type { BoardPriority, BoardStatus, BoardTask } from '../data/types'
import { notify } from '../lib/notify'
import { isTaskOverdue } from '../lib/tasks'

const boardColumns: { id: BoardStatus; title: string }[] = [
  { id: 'todo', title: '待办' },
  { id: 'doing', title: '进行中' },
  { id: 'done', title: '已完成' },
]

const priorityOptions: { id: BoardPriority; label: string }[] = [
  { id: 'high', label: '高' },
  { id: 'medium', label: '中' },
  { id: 'low', label: '低' },
]

const emptyForm = {
  id: '',
  title: '',
  course: '',
  due: '',
  dueDate: '',
  status: 'todo' as BoardStatus,
  priority: 'medium' as BoardPriority,
  desc: '',
}

function formatDueLabel(dueDate: string) {
  if (!dueDate) return '待定'
  const date = new Date(dueDate + 'T12:00:00')
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

type ContextMenuState = {
  taskId: string
  x: number
  y: number
}

type Props = {
  tasks: BoardTask[]
  onChange: (tasks: BoardTask[]) => void
}

export function TaskBoardPage({ tasks, onChange }: Props) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<BoardStatus | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const editing = Boolean(form.id)
  const contextTask = contextMenu ? tasks.find((task) => task.id === contextMenu.taskId) : null

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const pad = 8
    let x = contextMenu.x
    let y = contextMenu.y
    if (x + rect.width > window.innerWidth - pad) x = window.innerWidth - rect.width - pad
    if (y + rect.height > window.innerHeight - pad) y = window.innerHeight - rect.height - pad
    if (x !== contextMenu.x || y !== contextMenu.y) setContextMenu({ ...contextMenu, x, y })
  }, [contextMenu])

  const moveTask = (id: string, status: BoardStatus) => {
    const item = tasks.find((task) => task.id === id)
    if (!item || item.status === status) return
    onChange(tasks.map((task) => (task.id === id ? { ...task, status } : task)))
    notify.success(`已将「${item.title}」移至${boardColumns.find((column) => column.id === status)?.title}`)
  }

  const openCreate = (status: BoardStatus = 'todo') => {
    setContextMenu(null)
    setForm({ ...emptyForm, status })
    setComposerOpen(true)
  }

  const openEdit = (task: BoardTask) => {
    setContextMenu(null)
    setForm({
      id: task.id,
      title: task.title,
      course: task.course,
      due: task.due,
      dueDate: task.dueDate ?? '',
      status: task.status,
      priority: task.priority ?? 'medium',
      desc: task.desc ?? '',
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
    const existing = form.id ? tasks.find((task) => task.id === form.id) : undefined
    const due = form.dueDate ? formatDueLabel(form.dueDate) : form.due.trim() || '待定'
    const next: BoardTask = {
      id: form.id || uid('task'),
      title: form.title.trim(),
      course: form.course.trim() || '未关联课程',
      due,
      dueDate: form.dueDate || undefined,
      kind: existing?.kind ?? '教学',
      priority: form.priority,
      status: form.status,
      desc: form.desc.trim() || undefined,
      assignee: existing?.assignee ?? '本人',
      major: existing?.major ?? null,
    }
    onChange(form.id ? tasks.map((task) => (task.id === form.id ? next : task)) : [...tasks, next])
    notify.success(form.id ? `已更新：${next.title}` : `已创建并保存：${next.title}`)
    closeComposer()
  }

  const removeTaskById = (id: string) => {
    const item = tasks.find((task) => task.id === id)
    if (!item) return
    if (!window.confirm(`确定删除「${item.title}」？`)) return
    onChange(tasks.filter((task) => task.id !== id))
    notify.warning(`已删除：${item.title}`, '已删除')
    setContextMenu(null)
    if (form.id === id) closeComposer()
  }

  const removeTask = () => {
    if (!form.id) return
    removeTaskById(form.id)
  }

  return (
    <section className="task-board" aria-label="教学看板">
      <div className="page-actions">
        <button type="button" className="primary-action board-add" onClick={() => openCreate()}>
          ＋ 新建任务
        </button>
      </div>

      <div className="kanban-grid">
        {boardColumns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id)
          return (
            <section
              className={`kanban-column column-${column.id}${dragOverCol === column.id ? ' drag-over' : ''}`}
              key={column.id}
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
                  <h2>{column.title}</h2>
                </div>
                <b>{columnTasks.length}</b>
              </header>
              <div className="kanban-stack">
                {columnTasks.map((task) => {
                  const overdue = isTaskOverdue(task)
                  const priority = task.priority ?? 'medium'
                  return (
                    <article
                      className={`task-card priority-${priority}${draggingId === task.id ? ' dragging' : ''}${overdue ? ' is-overdue' : ''}${contextMenu?.taskId === task.id ? ' is-menu-open' : ''}`}
                      draggable
                      onDragStart={(event) => {
                        setContextMenu(null)
                        event.dataTransfer.setData('text/task-id', task.id)
                        event.dataTransfer.effectAllowed = 'move'
                        setDraggingId(task.id)
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDragOverCol(null)
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setContextMenu({ taskId: task.id, x: event.clientX, y: event.clientY })
                      }}
                      key={task.id}
                    >
                      <h3>{task.title}</h3>
                      <p className="task-desc">{task.desc || task.course}</p>
                      {task.desc && task.course ? <p className="task-course">{task.course}</p> : null}
                      <div className="task-card-footer">
                        <span className={overdue ? 'due urgent-due' : 'due'}>
                          {overdue ? '逾期 · ' : ''}
                          {task.due}
                        </span>
                      </div>
                    </article>
                  )
                })}
                {columnTasks.length === 0 && <div className="empty-column">暂无任务</div>}
              </div>
              <button type="button" className="column-add" onClick={() => openCreate(column.id)}>
                ＋ 添加任务
              </button>
            </section>
          )
        })}
      </div>

      {contextMenu && contextTask && (
        <div
          ref={menuRef}
          className="task-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={`任务操作：${contextTask.title}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => openEdit(contextTask)}>
            编辑
          </button>
          <button type="button" role="menuitem" className="is-danger" onClick={() => removeTaskById(contextTask.id)}>
            删除
          </button>
        </div>
      )}

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
                截止日期
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                />
              </label>
              <label>
                优先级
                <select
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value as BoardPriority })}
                >
                  {priorityOptions.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              看板状态
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as BoardStatus })}
              >
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
