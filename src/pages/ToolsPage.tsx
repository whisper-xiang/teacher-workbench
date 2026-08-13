import { useEffect, useMemo, useRef, useState } from 'react'
import { TOOL_CATEGORIES } from '../data/default-tools'
import { uid } from '../data/store'
import type { ToolCategory, ToolItem } from '../data/types'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'

type Draft = {
  id: string
  name: string
  description: string
  url: string
  category: ToolCategory
}

type MenuState = {
  toolId: string
  x: number
  y: number
}

const emptyDraft: Draft = { id: '', name: '', description: '', url: '', category: '备课工具' }

const CAT_META: Record<string, { icon: string; desc: string }> = {
  政策与学会: { icon: '🏛️', desc: '教育部、学会与教育媒体入口' },
  备课工具: { icon: '📚', desc: '课件制作、教学设计、课堂互动工具' },
  教学平台: { icon: '🏫', desc: '课程管理、在线教学、教务协同平台' },
  学术工具: { icon: '📖', desc: '文献检索、数据分析、质性研究工具' },
  效率工具: { icon: '⚡', desc: '问卷、协作文档、录屏、PDF 处理等效率工具' },
  AI工具: { icon: '🤖', desc: 'AI 对话、文档解析、学术搜索等 AI 辅助工具' },
  备课与课堂: { icon: '📝', desc: '备课与课堂相关入口' },
  研究与写作: { icon: '✍️', desc: '研究与写作相关入口' },
  协作与事务: { icon: '🤝', desc: '协作与事务相关入口' },
}

type Props = {
  tools: ToolItem[]
  favorites: string[]
  onChangeTools: (tools: ToolItem[]) => void
  onChangeFavorites: (ids: string[]) => void
}

export function ToolsPage({ tools, favorites, onChangeTools, onChangeFavorites }: Props) {
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const editing = Boolean(draft?.id)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tools
    return tools.filter((tool) =>
      `${tool.name}${tool.description}${tool.category}${tool.typeLabel ?? ''}${tool.tags?.join('') ?? ''}`
        .toLowerCase()
        .includes(q),
    )
  }, [tools, query])

  const sections = useMemo(() => {
    const order = [...TOOL_CATEGORIES]
    tools.forEach((tool) => {
      if (!order.includes(tool.category)) order.push(tool.category)
    })
    return order
      .map((category) => {
        const items = visible.filter((tool) => tool.category === category)
        return { category, items, total: tools.filter((tool) => tool.category === category).length }
      })
      .filter((section) => section.items.length > 0)
  }, [tools, visible])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
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
  }, [menu])

  useEffect(() => {
    if (!menu || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const pad = 8
    let x = menu.x
    let y = menu.y
    if (x + rect.width > window.innerWidth - pad) x = window.innerWidth - rect.width - pad
    if (y + rect.height > window.innerHeight - pad) y = window.innerHeight - rect.height - pad
    if (x !== menu.x || y !== menu.y) setMenu({ ...menu, x, y })
  }, [menu])

  const openMenu = (toolId: string, anchor: { clientX: number; clientY: number }) => {
    setMenu({ toolId, x: anchor.clientX, y: anchor.clientY })
  }

  const openCreate = () => setDraft({ ...emptyDraft })

  const openEdit = (tool: ToolItem) => {
    setMenu(null)
    setDraft({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      url: tool.url ?? '',
      category: tool.category,
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

  const toggleFavorite = (id: string) => {
    const saved = favorites.includes(id)
    onChangeFavorites(saved ? favorites.filter((item) => item !== id) : [...favorites, id])
    notify.success(saved ? '已移出常用' : '已加入常用')
    setMenu(null)
  }

  const removeById = async (id: string) => {
    const item = tools.find((tool) => tool.id === id)
    if (!item) return
    try {
      await confirm.delete(`确定删除「${item.name}」？`)
    } catch {
      return
    }
    onChangeTools(tools.filter((tool) => tool.id !== id))
    onChangeFavorites(favorites.filter((fav) => fav !== id))
    notify.warning(`已删除：${item.name}`, '已删除')
    setMenu(null)
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
      category: draft.category,
      initials: name.slice(0, 1),
      tone: existing?.tone ?? 'teal',
      icon: existing?.icon,
      url,
      typeLabel: existing?.typeLabel ?? '网页',
      tags: existing?.tags,
    }

    onChangeTools(draft.id ? tools.map((tool) => (tool.id === draft.id ? next : tool)) : [...tools, next])
    notify.success(draft.id ? `已更新「${name}」` : `已添加「${name}」`)
    closeDraft()
  }

  const menuTool = menu ? tools.find((tool) => tool.id === menu.toolId) : null

  return (
    <section className="tools-page" aria-label="工具箱">
      <div className="tools-banner">
        <div className="tools-banner-text">
          <h1>教师工具箱</h1>
          <p>精选 {tools.length} 款大学教师常用工具 · 备课 · 教学 · 科研 · 效率 · AI</p>
        </div>
        <button type="button" className="tools-banner-add" onClick={openCreate}>
          ＋ 添加工具
        </button>
      </div>

      <div className="tools-filter-bar">
        <label className="tools-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索工具名称或功能..."
            aria-label="搜索工具"
          />
        </label>
        <span className="tools-filter-count">共 {query.trim() ? visible.length : tools.length} 款工具</span>
      </div>

      {sections.length === 0 ? (
        <div className="tools-empty">
          <span aria-hidden="true">🧰</span>
          <h3>没有匹配的工具</h3>
          <p>试试其他关键词，或清空搜索</p>
          <button type="button" className="text-action" onClick={() => setQuery('')}>
            清除搜索
          </button>
        </div>
      ) : (
        sections.map((section) => {
          const meta = CAT_META[section.category] ?? { icon: '🔧', desc: '' }
          return (
            <section key={section.category} className="tools-section">
              <div className="tools-section-header">
                <h2 className="tools-section-title">
                  <span className="tools-section-icon" aria-hidden="true">
                    {meta.icon}
                  </span>
                  {section.category}
                </h2>
                <span className="tools-section-count">{section.items.length}款</span>
              </div>
              {meta.desc && <p className="tools-section-desc">{meta.desc}</p>}
              <div className="tools-grid">
                {section.items.map((tool) => {
                  const saved = favorites.includes(tool.id)
                  return (
                    <article
                      key={tool.id}
                      className={`tool-card${menu?.toolId === tool.id ? ' is-menu-open' : ''}${saved ? ' is-favorite' : ''}`}
                    >
                      <button type="button" className="tool-card-main" onClick={() => launch(tool)}>
                        <span className={`tool-card-icon${tool.icon ? '' : ` tone-${tool.tone}`}`} aria-hidden="true">
                          {tool.icon ?? tool.initials}
                        </span>
                        <span className="tool-card-info">
                          <span className="tool-card-name">{tool.name}</span>
                          {tool.typeLabel && <span className="tool-card-type">{tool.typeLabel}</span>}
                          <span className="tool-card-desc">{tool.description}</span>
                          {tool.tags && tool.tags.length > 0 && (
                            <span className="tool-card-tags">
                              {tool.tags.map((tag) => (
                                <em key={tag} className="tool-card-tag">
                                  {tag}
                                </em>
                              ))}
                            </span>
                          )}
                        </span>
                        <span className="tool-card-arrow" aria-hidden="true">
                          ↗
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`tool-favorite${saved ? ' saved' : ''}`}
                        aria-label={saved ? '移出常用' : '加入常用'}
                        onClick={() => toggleFavorite(tool.id)}
                      >
                        {saved ? '★' : '☆'}
                      </button>
                      <button
                        type="button"
                        className="tool-menu-btn"
                        aria-label={`更多操作：${tool.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          openMenu(tool.id, { clientX: event.clientX, clientY: event.clientY })
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          openMenu(tool.id, { clientX: event.clientX, clientY: event.clientY })
                        }}
                      >
                        ⋯
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })
      )}

      {menu && menuTool && (
        <div
          ref={menuRef}
          className="task-context-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          aria-label={`工具操作：${menuTool.name}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => launch(menuTool)}>
            打开链接
          </button>
          <button type="button" role="menuitem" onClick={() => toggleFavorite(menuTool.id)}>
            {favorites.includes(menuTool.id) ? '移出常用' : '加入常用'}
          </button>
          <button type="button" role="menuitem" onClick={() => openEdit(menuTool)}>
            编辑
          </button>
          <button type="button" role="menuitem" className="is-danger" onClick={() => removeById(menuTool.id)}>
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
              分类
              <select
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value as ToolCategory })}
              >
                {TOOL_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
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
