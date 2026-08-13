import { useEffect, useMemo, useRef, useState } from 'react'
import { uid } from '../data/store'
import type { Course, TeachingResource } from '../data/types'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'

const RESOURCE_TYPES = ['课件', '教案', '试题', '视频', '文献'] as const

type ContextMenuState = {
  resourceId: string
  x: number
  y: number
}

type Props = {
  resources: TeachingResource[]
  courses: Course[]
  onChangeResources: (resources: TeachingResource[]) => void
}

export function ResourcesPage({ resources, courses, onChangeResources }: Props) {
  const [query, setQuery] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editing, setEditing] = useState<TeachingResource | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const courseNames = courses.map((course) => course.name)
  const contextResource = contextMenu ? resources.find((item) => item.id === contextMenu.resourceId) : null

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return resources
    return resources.filter((item) =>
      `${item.title}${item.course}${item.type}${item.description}`.toLowerCase().includes(q),
    )
  }, [resources, query])

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

  const openComposer = (item: TeachingResource | null) => {
    setContextMenu(null)
    setEditing(item)
    setComposerOpen(true)
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setEditing(null)
  }

  const removeById = async (id: string) => {
    const item = resources.find((resource) => resource.id === id)
    if (!item) return
    try {
      await confirm.delete(`确定删除「${item.title}」？`)
    } catch {
      return
    }
    onChangeResources(resources.filter((resource) => resource.id !== id))
    notify.warning(`已删除：${item.title}`, '已删除')
    setContextMenu(null)
    if (editing?.id === id) closeComposer()
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const courseName = String(form.get('course') || '').trim()
    const linked = courses.find((course) => course.name === courseName)
    const base = {
      title: String(form.get('title') || '').trim(),
      course: courseName || '未关联课程',
      type: String(form.get('type')) as TeachingResource['type'],
      updated: '刚刚',
      size: editing?.size ?? '—',
      accent: editing?.accent ?? 'teal',
      description: String(form.get('description') || '').trim() || '本地登记的教学资源。',
      tags: editing?.tags ?? [],
      major: linked?.major ?? editing?.major,
      format: editing?.format ?? '其他',
      usedCount: editing?.usedCount,
      lastUsed: editing?.lastUsed,
    }
    if (!base.title) return

    if (editing) {
      onChangeResources(resources.map((item) => (item.id === editing.id ? { ...item, ...base } : item)))
      notify.success(`已更新「${base.title}」`)
    } else {
      onChangeResources([{ ...base, id: uid('res') }, ...resources])
      notify.success(`已登记「${base.title}」`)
    }
    closeComposer()
  }

  return (
    <section className="resources-page resources-page-simple" aria-label="教学资源库">
      <div className="page-actions">
        <button type="button" className="primary-action" onClick={() => openComposer(null)}>
          ＋ 登记资源
        </button>
      </div>

      <label className="resource-search-simple">
        <span>⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索标题、课程或类型"
          aria-label="搜索教学资源"
        />
      </label>

      <div className="resource-list-simple">
        {visible.map((item) => (
          <article
            key={item.id}
            className={`resource-row${contextMenu?.resourceId === item.id ? ' is-menu-open' : ''}`}
            onContextMenu={(event) => {
              event.preventDefault()
              setContextMenu({ resourceId: item.id, x: event.clientX, y: event.clientY })
            }}
          >
            <span className="resource-type-pill">{item.type}</span>
            <div className="resource-row-body">
              <strong>{item.title}</strong>
              <small>{item.course}</small>
            </div>
          </article>
        ))}
        {visible.length === 0 && (
          <div className="resource-empty-simple">
            {resources.length === 0 ? '暂无资源，点击右上角登记' : '没有匹配的资源'}
          </div>
        )}
      </div>

      {contextMenu && contextResource && (
        <div
          ref={menuRef}
          className="task-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={`资源操作：${contextResource.title}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => openComposer(contextResource)}>
            编辑
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={() => removeById(contextResource.id)}
          >
            删除
          </button>
        </div>
      )}

      {composerOpen && (
        <div className="resources-modal-backdrop" onMouseDown={closeComposer}>
          <form
            className="resources-composer"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={handleSubmit}
          >
            <div>
              <p className="section-label">{editing ? '编辑资源' : '登记资源'}</p>
              <h2>{editing ? `修改「${editing.title}」` : '添加到本地索引'}</h2>
            </div>
            <label>
              标题
              <input name="title" required autoFocus defaultValue={editing?.title} />
            </label>
            <div className="composer-grid">
              <label>
                类型
                <select name="type" defaultValue={editing?.type ?? '课件'}>
                  {RESOURCE_TYPES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                关联课程
                <select name="course" defaultValue={editing?.course ?? ''}>
                  <option value="">未关联课程</option>
                  {courseNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {editing && editing.course !== '未关联课程' && !courseNames.includes(editing.course) && (
                    <option value={editing.course}>{editing.course}（原记录）</option>
                  )}
                </select>
              </label>
            </div>
            <label>
              说明
              <input name="description" defaultValue={editing?.description} placeholder="一句话说明用途（可选）" />
            </label>
            <div className="composer-actions">
              {editing && (
                <button type="button" className="danger-action" onClick={() => removeById(editing.id)}>
                  删除
                </button>
              )}
              <span className="composer-actions-spacer" />
              <button type="button" className="outline-action" onClick={closeComposer}>
                取消
              </button>
              <button type="submit" className="primary-action">
                {editing ? '保存修改' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
