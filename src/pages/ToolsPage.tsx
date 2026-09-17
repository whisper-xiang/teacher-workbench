import { useEffect, useMemo, useRef, useState } from 'react'
import '../tools.css'
import { GradeSimPanel } from '../components/tools/GradeSimPanel'
import { RollcallPanel } from '../components/tools/RollcallPanel'
import {
  isNativeTool,
  nativeToolByParam,
  NATIVE_TOOL_IDS,
  TOOL_CATEGORIES,
} from '../data/default-tools'
import { uid } from '../data/store'
import type { Course, GradeItem, StudentRecord, ToolCategory, ToolItem } from '../data/types'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'
import { NavIcon, type IconName } from '../nav-icons'

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

const emptyDraft: Draft = { id: '', name: '', description: '', url: '', category: '我的入口' }

const CAT_META: Record<ToolCategory, { icon: IconName; desc: string }> = {
  文献与平台: { icon: 'research', desc: '知网、期刊与文献管理' },
  课堂与教务: { icon: 'courses', desc: '课堂平台、教材与问卷' },
  我的入口: { icon: 'pin', desc: '自己添加的常用网页' },
}

type Props = {
  tools: ToolItem[]
  favorites: string[]
  courses: Course[]
  students: StudentRecord[]
  grades: GradeItem[]
  initialToolId?: string
  onChangeTools: (tools: ToolItem[]) => void
  onChangeFavorites: (ids: string[]) => void
  onChangeGrades: (grades: GradeItem[]) => void
  onOpenTool: (id?: string) => void
  onOpenStudents: (courseId: string) => void
}

function nativeIcon(id: string): IconName {
  return id === 'native-gradesim' ? 'tasks' : 'students'
}

function matchesQuery(tool: ToolItem, query: string) {
  return `${tool.name}${tool.description}${tool.category}${tool.typeLabel ?? ''}${tool.tags?.join('') ?? ''}`
    .toLowerCase()
    .includes(query)
}

function touch(tools: ToolItem[], id: string) {
  const now = new Date().toISOString()
  return tools.map((tool) => (tool.id === id ? { ...tool, lastUsedAt: now } : tool))
}

export function ToolsPage({
  tools,
  favorites,
  courses,
  students,
  grades,
  initialToolId,
  onChangeTools,
  onChangeFavorites,
  onChangeGrades,
  onOpenTool,
  onOpenStudents,
}: Props) {
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const editing = Boolean(draft?.id)
  const activeNative = nativeToolByParam(tools, initialToolId)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tools
    return tools.filter((tool) => matchesQuery(tool, q))
  }, [tools, query])

  const natives = useMemo(() => {
    return visible
      .filter(isNativeTool)
      .sort((left, right) => {
        const a = NATIVE_TOOL_IDS.findIndex((id) => id === left.id)
        const b = NATIVE_TOOL_IDS.findIndex((id) => id === right.id)
        return (a < 0 ? 99 : a) - (b < 0 ? 99 : b)
      })
  }, [visible])

  const favoriteItems = useMemo(
    () => visible.filter((tool) => favorites.includes(tool.id) && !isNativeTool(tool)),
    [visible, favorites],
  )

  const sections = useMemo(() => {
    const order = [...TOOL_CATEGORIES]
    visible.forEach((tool) => {
      if (!isNativeTool(tool) && !order.includes(tool.category)) order.push(tool.category)
    })
    return order
      .map((category) => ({
        category,
        items: visible.filter((tool) => !isNativeTool(tool) && tool.category === category),
      }))
      .filter((section) => section.items.length > 0)
  }, [visible])

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
    if (isNativeTool(tool)) return
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
    if (isNativeTool(tool)) {
      onChangeTools(touch(tools, tool.id))
      onOpenTool(tool.nativeId)
      return
    }
    if (tool.url) {
      onChangeTools(touch(tools, tool.id))
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
    if (!item || isNativeTool(item)) return
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
    const description = draft.description.trim() || '常用入口'
    const url = draft.url.trim() || undefined
    const existing = draft.id ? tools.find((tool) => tool.id === draft.id) : undefined
    if (existing && isNativeTool(existing)) return

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
      kind: 'link',
      lastUsedAt: existing?.lastUsedAt,
    }

    onChangeTools(draft.id ? tools.map((tool) => (tool.id === draft.id ? next : tool)) : [...tools, next])
    notify.success(draft.id ? `已更新「${name}」` : `已添加「${name}」`)
    closeDraft()
  }

  const menuTool = menu ? tools.find((tool) => tool.id === menu.toolId) : null

  const renderCard = (tool: ToolItem) => {
    const saved = favorites.includes(tool.id)
    const native = isNativeTool(tool)
    return (
      <article
        key={tool.id}
        className={`tool-card${menu?.toolId === tool.id ? ' is-menu-open' : ''}${saved ? ' is-favorite' : ''}${native ? ' is-native' : ''}`}
      >
        <button type="button" className="tool-card-main" onClick={() => launch(tool)}>
          <span className="tool-card-icon" aria-hidden="true">
            {native ? <NavIcon name={nativeIcon(tool.id)} size={18} /> : tool.initials}
          </span>
          <span className="tool-card-info">
            <span className="tool-card-name">{tool.name}</span>
            {tool.typeLabel && <span className="tool-card-type">{tool.typeLabel}</span>}
            <span className="tool-card-desc">{tool.description}</span>
          </span>
          <span className="tool-card-arrow" aria-hidden="true">
            {native ? '→' : '↗'}
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

  if (activeNative) {
    return (
      <section className="tools-page" aria-label={activeNative.name}>
        <div className="tools-heading">
          <div>
            <button type="button" className="text-action tools-back" onClick={() => onOpenTool()}>
              ← 返回工具箱
            </button>
            <h1>{activeNative.name}</h1>
            <p>{activeNative.description}</p>
          </div>
        </div>
        {activeNative.nativeId === 'rollcall' ? (
          <RollcallPanel courses={courses} students={students} onOpenStudents={onOpenStudents} />
        ) : (
          <GradeSimPanel
            courses={courses}
            students={students}
            grades={grades}
            onChangeGrades={onChangeGrades}
            onOpenStudents={onOpenStudents}
          />
        )}
      </section>
    )
  }

  const searching = Boolean(query.trim())
  const empty = natives.length === 0 && favoriteItems.length === 0 && sections.length === 0

  return (
    <section className="tools-page" aria-label="工具箱">
      <div className="tools-heading">
        <div>
          <p className="section-label">资讯与工具</p>
          <h1>教师工具箱</h1>
          <p>本机小工具，算完能用；外链只留每周会点的</p>
        </div>
        <button type="button" className="primary-action" onClick={openCreate}>
          ＋ 添加入口
        </button>
      </div>

      <div className="tools-filter-bar">
        <label className="tools-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索本机工具或入口"
            aria-label="搜索工具"
          />
        </label>
        <span className="tools-filter-count">
          {searching ? `${visible.length} 个匹配` : `${natives.length} 个本机 · ${tools.filter((tool) => !isNativeTool(tool)).length} 个入口`}
        </span>
      </div>

      {empty ? (
        <div className="tools-empty">
          <h3>没有匹配的工具</h3>
          <p>试试其他关键词，或清空搜索</p>
          <button type="button" className="text-action" onClick={() => setQuery('')}>
            清除搜索
          </button>
        </div>
      ) : (
        <>
          {natives.length > 0 && (
            <section className="tools-section">
              <div className="tools-section-header">
                <h2 className="tools-section-title">
                  <span className="tools-section-icon" aria-hidden="true">
                    <NavIcon name="tools" size={18} />
                  </span>
                  本机工具
                </h2>
                <span className="tools-section-count">{natives.length}</span>
              </div>
              <p className="tools-section-desc">读花名册和成绩，用完可复制或写回工作台</p>
              <div className="tools-grid">{natives.map(renderCard)}</div>
            </section>
          )}

          {favoriteItems.length > 0 && (
            <section className="tools-section">
              <div className="tools-section-header">
                <h2 className="tools-section-title">
                  <span className="tools-section-icon" aria-hidden="true">
                    <NavIcon name="pin" size={18} />
                  </span>
                  常用
                </h2>
                <span className="tools-section-count">{favoriteItems.length}</span>
              </div>
              <p className="tools-section-desc">收藏的网页入口会出现在这里</p>
              <div className="tools-grid">{favoriteItems.map(renderCard)}</div>
            </section>
          )}

          {sections.map((section) => {
            const meta = CAT_META[section.category] ?? { icon: 'tools' as IconName, desc: '' }
            return (
              <section key={section.category} className="tools-section">
                <div className="tools-section-header">
                  <h2 className="tools-section-title">
                    <span className="tools-section-icon" aria-hidden="true">
                      <NavIcon name={meta.icon} size={18} />
                    </span>
                    {section.category}
                  </h2>
                  <span className="tools-section-count">{section.items.length}</span>
                </div>
                {meta.desc && <p className="tools-section-desc">{meta.desc}</p>}
                <div className="tools-grid">{section.items.map(renderCard)}</div>
              </section>
            )
          })}
        </>
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
            {isNativeTool(menuTool) ? '打开' : '打开链接'}
          </button>
          <button type="button" role="menuitem" onClick={() => toggleFavorite(menuTool.id)}>
            {favorites.includes(menuTool.id) ? '移出常用' : '加入常用'}
          </button>
          {!isNativeTool(menuTool) && (
            <>
              <button type="button" role="menuitem" onClick={() => openEdit(menuTool)}>
                编辑
              </button>
              <button type="button" role="menuitem" className="is-danger" onClick={() => removeById(menuTool.id)}>
                删除
              </button>
            </>
          )}
        </div>
      )}

      {draft && (
        <div className="tools-modal-backdrop" onMouseDown={closeDraft}>
          <form className="tools-composer" onMouseDown={(event) => event.stopPropagation()} onSubmit={save}>
            <div>
              <p className="section-label">{editing ? '编辑入口' : '添加入口'}</p>
              <h2>{editing ? '修改常用网页' : '添加常用网页'}</h2>
            </div>
            <label>
              名称
              <input
                required
                autoFocus
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="例如：学院教务通知"
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
