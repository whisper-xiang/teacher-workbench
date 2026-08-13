import { useEffect, useMemo, useRef, useState } from 'react'
import { uid } from '../data/store'
import type { ToolCategory, ToolItem } from '../data/types'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'

const ALL = '全部'
const FAVORITES = '常用'
const TOOL_CATEGORIES: ToolCategory[] = ['备课工具', '教学平台', '学术工具', '效率工具', 'AI工具']
const FILTERS = [ALL, FAVORITES, ...TOOL_CATEGORIES] as const

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

const emptyDraft: Draft = { id: '', name: '', description: '', url: '', category: '效率工具' }

type Props = {
  tools: ToolItem[]
  favorites: string[]
  onChangeTools: (tools: ToolItem[]) => void
  onChangeFavorites: (ids: string[]) => void
}

export function ToolsPage({ tools, favorites, onChangeTools, onChangeFavorites }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>(ALL)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const editing = Boolean(draft?.id)
  const menuTool = menu ? tools.find((tool) => tool.id === menu.toolId) : null
  const categoryCount = new Set(tools.map((tool) => tool.category)).size
  const withUrlCount = tools.filter((tool) => tool.url).length

  const activeFilters = useMemo(
    () => FILTERS.filter((item) => item === ALL || item === FAVORITES || tools.some((tool) => tool.category === item)),
    [tools],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = tools
    if (category === FAVORITES) list = tools.filter((tool) => favorites.includes(tool.id))
    else if (category !== ALL) list = tools.filter((tool) => tool.category === category)

    if (q) {
      list = list.filter((tool) =>
        `${tool.name}${tool.description}${tool.category}${tool.typeLabel ?? ''}${tool.tags?.join('') ?? ''}`
          .toLowerCase()
          .includes(q),
      )
    }

    if (category === ALL) {
      list = [...list].sort((a, b) => {
        const aRank = favorites.includes(a.id) ? 0 : 1
        const bRank = favorites.includes(b.id) ? 0 : 1
        return aRank - bRank || a.name.localeCompare(b.name, 'zh-CN')
      })
    }

    return list
  }, [tools, query, category, favorites])

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

  const openCreate = () => {
    setMenu(null)
    setDraft({ ...emptyDraft })
  }

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
    onChangeFavorites(favorites.filter((item) => item !== id))
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
      url,
      typeLabel: existing?.typeLabel ?? '网页',
      tags: existing?.tags,
    }

    onChangeTools(draft.id ? tools.map((tool) => (tool.id === draft.id ? next : tool)) : [...tools, next])
    notify.success(draft.id ? `已更新「${name}」` : `已添加「${name}」`)
    closeDraft()
  }

  const clearFilters = () => {
    setQuery('')
    setCategory(ALL)
  }

  const renderToolCard = (tool: ToolItem) => {
    const saved = favorites.includes(tool.id)
    return (
      <article key={tool.id} className={`tool-card${menu?.toolId === tool.id ? ' is-menu-open' : ''}${saved ? ' is-favorite' : ''}`}>
        <button type="button" className="tool-card-main" onClick={() => launch(tool)}>
          <span className={`tool-avatar tone-${tool.tone}`} aria-hidden="true">
            {tool.initials}
          </span>
          <span className="tool-card-body">
            <span className="tool-category">{tool.category}</span>
            <strong>{tool.name}</strong>
            <small>{tool.description}</small>
            <span className="tool-card-meta">
              {tool.typeLabel && <em>{tool.typeLabel}</em>}
              {tool.tags?.slice(0, 2).map((tag) => (
                <em key={tag}>{tag}</em>
              ))}
              <em>{tool.url ? '点击打开' : '未填写链接'}</em>
            </span>
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
  }

  return (
    <section className="tools-page" aria-label="工具箱">
      <div className="tools-heading">
        <div>
          <p className="section-label">资讯与工具</p>
          <h1>工具箱</h1>
          <p>教学常用网站与应用入口 · 点击即可打开 · 本地离线可用</p>
        </div>
        <button type="button" className="primary-action" onClick={openCreate}>
          ＋ 添加工具
        </button>
      </div>

      <div className="tools-notice">
        <span aria-hidden="true">ℹ</span>
        <span>预置常用教学工具，可加入常用置顶；点击 ⋯ 可编辑或删除。</span>
      </div>

      <div className="tools-overview">
        <div>
          <span>工具总数</span>
          <strong>{tools.length}</strong>
          <small>涵盖 {categoryCount} 个分类</small>
        </div>
        <div>
          <span>常用工具</span>
          <strong>{favorites.length}</strong>
          <small>列表优先展示</small>
        </div>
        <div>
          <span>可打开链接</span>
          <strong>{withUrlCount}</strong>
          <small>{tools.length - withUrlCount} 个待补链接</small>
        </div>
      </div>

      <div className="tools-toolbar">
        <label className="tools-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、分类或标签"
            aria-label="搜索工具"
          />
        </label>
        <div className="tools-filters" role="tablist" aria-label="分类筛选">
          {activeFilters.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              className={category === item ? 'active' : ''}
              onClick={() => setCategory(item)}
            >
              {item}
              {item === FAVORITES && favorites.length > 0 ? ` ${favorites.length}` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="tools-feed">
        <div className="tools-feed-head">
          <h2>{category === FAVORITES ? '常用工具' : '全部工具'}</h2>
          <span>{visible.length} 个</span>
        </div>

        {visible.length === 0 ? (
          <div className="tools-empty">
            <span aria-hidden="true">🧰</span>
            <h3>{category === FAVORITES ? '还没有常用工具' : '没有匹配的工具'}</h3>
            <p>{category === FAVORITES ? '点击工具旁的 ☆ 加入常用' : '试试调整搜索词或分类筛选'}</p>
            {category !== FAVORITES && (
              <button type="button" className="text-action" onClick={clearFilters}>
                清除筛选
              </button>
            )}
          </div>
        ) : (
          <div className="tools-grid">{visible.map(renderToolCard)}</div>
        )}
      </div>

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
