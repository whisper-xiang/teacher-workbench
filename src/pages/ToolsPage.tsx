import { useEffect, useRef, useState } from 'react'
import { uid } from '../data/store'
import type { ToolItem } from '../data/types'
import { notify } from '../lib/notify'

type Draft = {
  id: string
  name: string
  description: string
  url: string
}

type ContextMenuState = {
  toolId: string
  x: number
  y: number
}

const emptyDraft: Draft = { id: '', name: '', description: '', url: '' }

type Props = {
  tools: ToolItem[]
  onChangeTools: (tools: ToolItem[]) => void
}

export function ToolsPage({ tools, onChangeTools }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const editing = Boolean(draft?.id)
  const contextTool = contextMenu ? tools.find((tool) => tool.id === contextMenu.toolId) : null

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

  const openCreate = () => {
    setContextMenu(null)
    setDraft({ ...emptyDraft })
  }

  const openEdit = (tool: ToolItem) => {
    setContextMenu(null)
    setDraft({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      url: tool.url ?? '',
    })
  }

  const closeDraft = () => setDraft(null)

  const launch = (tool: ToolItem) => {
    if (tool.url) {
      window.open(tool.url, '_blank', 'noopener,noreferrer')
      notify.success(`已打开「${tool.name}」`)
      return
    }
    notify.info(`「${tool.name}」尚未填写链接`)
  }

  const removeById = (id: string) => {
    const item = tools.find((tool) => tool.id === id)
    if (!item) return
    if (!window.confirm(`确定删除「${item.name}」？`)) return
    onChangeTools(tools.filter((tool) => tool.id !== id))
    notify.warning(`已删除：${item.name}`, '已删除')
    setContextMenu(null)
    if (draft?.id === id) closeDraft()
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft?.name.trim()) return
    const name = draft.name.trim()
    const description = draft.description.trim() || '常用工具入口'
    const url = draft.url.trim() || undefined
    const existing = draft.id ? tools.find((tool) => tool.id === draft.id) : undefined

    const next: ToolItem = {
      id: draft.id || uid('tool'),
      name,
      description,
      category: existing?.category ?? '效率工具',
      initials: name.slice(0, 1),
      tone: existing?.tone ?? 'teal',
      url,
      typeLabel: existing?.typeLabel,
      tags: existing?.tags,
    }

    onChangeTools(draft.id ? tools.map((tool) => (tool.id === draft.id ? next : tool)) : [...tools, next])
    notify.success(draft.id ? `已更新「${name}」` : `已添加「${name}」`)
    closeDraft()
  }

  return (
    <section className="tools-page tools-page-simple" aria-label="工具箱">
      <div className="page-actions">
        <button type="button" className="primary-action" onClick={openCreate}>
          ＋ 添加工具
        </button>
      </div>

      <div className="tools-list-simple">
        {tools.map((tool) => (
          <button
            type="button"
            key={tool.id}
            className={`tool-row${contextMenu?.toolId === tool.id ? ' is-menu-open' : ''}`}
            onClick={() => launch(tool)}
            onContextMenu={(event) => {
              event.preventDefault()
              setContextMenu({ toolId: tool.id, x: event.clientX, y: event.clientY })
            }}
          >
            <strong>{tool.name}</strong>
            <small>{tool.description}</small>
            <em>{tool.url ? '点击打开' : '未填写链接'}</em>
          </button>
        ))}
        {tools.length === 0 && <div className="tools-empty-simple">暂无工具，点击右上角添加</div>}
      </div>

      {contextMenu && contextTool && (
        <div
          ref={menuRef}
          className="task-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={`工具操作：${contextTool.name}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => openEdit(contextTool)}>
            编辑
          </button>
          <button type="button" role="menuitem" className="is-danger" onClick={() => removeById(contextTool.id)}>
            删除
          </button>
        </div>
      )}

      {draft && (
        <div className="tools-modal-backdrop" onMouseDown={closeDraft}>
          <form className="tools-composer" onMouseDown={(event) => event.stopPropagation()} onSubmit={save}>
            <div>
              <p className="section-label">{editing ? '编辑工具' : '添加工具'}</p>
              <h2>{editing ? '修改常用入口' : '添加常用入口'}</h2>
            </div>
            <label>
              工具名称
              <input
                required
                autoFocus
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="例如：课程云平台"
              />
            </label>
            <label>
              链接
              <input
                type="url"
                value={draft.url}
                onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                placeholder="https://"
              />
            </label>
            <label>
              说明（可选）
              <input
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="一句话说明用途"
              />
            </label>
            <div className="tools-composer-actions">
              {editing && (
                <button type="button" className="danger-action" onClick={() => removeById(draft.id)}>
                  删除
                </button>
              )}
              <span className="composer-actions-spacer" />
              <button type="button" className="outline-action" onClick={closeDraft}>
                取消
              </button>
              <button type="submit" className="primary-action">
                {editing ? '保存修改' : '添加'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
