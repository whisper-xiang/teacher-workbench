import { useState } from 'react'
import { MajorFilter, MajorTag } from '../components/MajorTag'
import { uid } from '../data/store'
import type { Course, MajorId, TeachingResource } from '../data/types'
import { notify } from '../lib/notify'

const RESOURCE_TYPES = ['课件', '教案', '试题', '视频', '文献'] as const
type TypeFilter = '全部' | (typeof RESOURCE_TYPES)[number]

type Props = {
  resources: TeachingResource[]
  savedResources: string[]
  courses: Course[]
  onChangeResources: (resources: TeachingResource[]) => void
  onChangeSaved: (ids: string[]) => void
}

export function ResourcesPage({ resources, savedResources, courses, onChangeResources, onChangeSaved }: Props) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<TypeFilter>('全部')
  const [major, setMajor] = useState<MajorId | '' | 'general'>('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [selectedId, setSelectedId] = useState(resources[0]?.id ?? '')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editing, setEditing] = useState<TeachingResource | null>(null)

  const selected = resources.find((item) => item.id === selectedId) ?? resources[0]
  const saved = new Set(savedResources)

  const visible = resources.filter(
    (item) =>
      (type === '全部' || item.type === type) &&
      (!savedOnly || saved.has(item.id)) &&
      (!major || major === 'general' || item.major === major) &&
      `${item.title}${item.course}${item.tags.join('')}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const typeCount = (item: TypeFilter) =>
    item === '全部' ? resources.length : resources.filter((r) => r.type === item).length
  const usedCount = resources.reduce((sum, r) => sum + (r.usedCount ?? 0), 0)
  const courseNames = courses.map((c) => c.name)

  const toggleSaved = (id: string) => {
    onChangeSaved(saved.has(id) ? savedResources.filter((item) => item !== id) : [...savedResources, id])
  }
  const resourceIcon = (kind: TeachingResource['type']) =>
    ({ 课件: '▣', 教案: '✦', 试题: '☷', 视频: '▶', 文献: '≡' })[kind]

  const markUsed = (item: TeachingResource) => {
    onChangeResources(
      resources.map((r) => (r.id === item.id ? { ...r, usedCount: (r.usedCount ?? 0) + 1, lastUsed: '刚刚' } : r)),
    )
    notify.success(`已记录「${item.title}」使用 ${(item.usedCount ?? 0) + 1} 次`)
  }

  const removeResource = () => {
    if (!selected) return
    if (!window.confirm(`确定删除「${selected.title}」？删除后不可恢复。`)) return
    const rest = resources.filter((r) => r.id !== selected.id)
    onChangeResources(rest)
    if (saved.has(selected.id)) onChangeSaved(savedResources.filter((id) => id !== selected.id))
    setSelectedId(rest[0]?.id ?? '')
    notify.warning(`已删除：${selected.title}`, '已删除')
  }

  const openComposer = (item: TeachingResource | null) => {
    setEditing(item)
    setComposerOpen(true)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const courseName = String(form.get('course') || '').trim()
    const linked = courses.find((c) => c.name === courseName)
    const base = {
      title: String(form.get('title') || '').trim(),
      course: courseName || '未关联课程',
      type: String(form.get('type')) as TeachingResource['type'],
      updated: '刚刚',
      size: String(form.get('size')).trim() || '—',
      accent: editing?.accent ?? 'teal',
      description: String(form.get('description')).trim() || '本地登记的教学资源。',
      tags: String(form.get('tags') || '')
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
      major: linked?.major ?? editing?.major,
      format: editing?.format ?? '其他',
      usedCount: editing?.usedCount,
      lastUsed: editing?.lastUsed,
    }
    if (editing) {
      onChangeResources(resources.map((r) => (r.id === editing.id ? { ...r, ...base } : r)))
      notify.success(`已更新「${base.title}」`)
    } else {
      const next: TeachingResource = { ...base, id: uid('res') }
      onChangeResources([next, ...resources])
      setSelectedId(next.id)
      notify.success(`已登记「${next.title}」`)
    }
    setComposerOpen(false)
    setEditing(null)
  }

  if (!selected) return <section className="resources-page"><p>暂无资源，点击右上角「登记资源」开始归档。</p></section>

  return (
    <section className="resources-page" aria-label="教学资源库">
      <div className="page-actions">
          <button
            className="outline-action"
            onClick={() => {
              const blob = new Blob([JSON.stringify(resources, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `teaching-resources-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
              notify.success('已导出资源清单 JSON')
            }}
          >
            导出清单
          </button>
          <button className="primary-action" onClick={() => openComposer(null)}>
            ＋ 登记资源
          </button>
      </div>
      <section className="resource-hero" aria-label="资源库概览">
        <div className="resource-hero-mark">档</div>
        <div>
          <span>我的教学资料</span>
          <strong>
            {resources.length} <small>份资源已归档</small>
          </strong>
        </div>
        <div className="resource-hero-stats">
          <span>
            <b>{resources.length}</b> 本地索引
          </span>
          <span>
            <b>{new Set(resources.map((r) => r.course)).size}</b> 门课程关联
          </span>
          <span>
            <b>{saved.size}</b> 已收藏
          </span>
          <span>
            <b>{usedCount}</b> 累计使用
          </span>
        </div>
      </section>
      <div className="resources-workspace">
        <section className="resource-browser">
          <div className="resource-toolbar">
            <label className="resource-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题、课程或标签"
                aria-label="搜索教学资源"
              />
            </label>
            <MajorFilter value={major} onChange={setMajor} /><div className="resource-filter" aria-label="资源类型筛选">
              {(['全部', ...RESOURCE_TYPES] as TypeFilter[]).map((item) => (
                <button key={item} className={type === item ? 'active' : ''} onClick={() => setType(item)}>
                  {item}
                  <small>{typeCount(item)}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="resource-list-meta">
            <span>共 {visible.length} 份资源</span>
            <button className={savedOnly ? 'active' : ''} onClick={() => setSavedOnly((v) => !v)}>
              {savedOnly ? '★ 仅看收藏' : '☆ 仅看收藏'}
            </button>
          </div>
          <div className="resource-grid">
            {visible.map((item) => (
              <article key={item.id} className={selectedId === item.id ? 'resource-card selected' : 'resource-card'}>
                <button className={`resource-cover cover-${item.accent}`} onClick={() => setSelectedId(item.id)} aria-label={`查看 ${item.title}`}>
                  <span>{resourceIcon(item.type)}</span>
                  <small>{item.type}</small>
                </button>
                <div className="resource-card-body">
                  <button className="resource-card-title" onClick={() => setSelectedId(item.id)}>
                    <b>{item.title}</b>
                    <span>
                      {item.course} · {item.updated} · <MajorTag major={item.major} compact />
                    </span>
                  </button>
                  <button
                    className={saved.has(item.id) ? 'save-resource saved' : 'save-resource'}
                    onClick={() => toggleSaved(item.id)}
                    aria-label={saved.has(item.id) ? '取消收藏' : '收藏资源'}
                  >
                    {saved.has(item.id) ? '★' : '☆'}
                  </button>
                </div>
              </article>
            ))}
            {visible.length === 0 && (
              <div className="resource-empty">
                没有匹配的资源
                <br />
                <small>换一个关键词、类型，或关闭「仅看收藏」试试。</small>
              </div>
            )}
          </div>
        </section>
        <aside className="resource-preview" aria-label="资源详情">
          <div className={`preview-visual cover-${selected.accent}`}>
            <span>{resourceIcon(selected.type)}</span>
            <small>{selected.type.toUpperCase()}</small>
          </div>
          <div className="preview-content">
            <p className="section-label">资源详情</p>
            <h2>{selected.title}</h2>
            <p>{selected.description}</p>
            <div className="preview-course">
              <span>关联课程</span>
              <b>{selected.course}</b>
            </div>
            <div className="resource-tags">
              {selected.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="preview-foot">
              <span>
                {selected.size} · 更新于 {selected.updated}
                {selected.usedCount ? ` · 已使用 ${selected.usedCount} 次${selected.lastUsed ? `（${selected.lastUsed}）` : ''}` : ''}
              </span>
              <div className="preview-actions">
                <button className="outline-action" onClick={() => openComposer(selected)}>
                  编辑
                </button>
                <button className="danger-action" onClick={removeResource}>
                  删除
                </button>
                <button className="primary-action" onClick={() => markUsed(selected)}>
                  标记已用
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {composerOpen && (
        <div className="resources-modal-backdrop" onMouseDown={() => openComposer(null)}>
          <form
            className="resources-composer"
            onMouseDown={(e) => e.stopPropagation()}
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
            <label>
              关联课程（选填）
              <select name="course" defaultValue={editing?.course ?? ''}>
                <option value="">未关联课程</option>
                {courseNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                {editing && !courseNames.includes(editing.course) && (
                  <option value={editing.course}>{editing.course}（原记录）</option>
                )}
              </select>
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
                大小
                <input name="size" placeholder="2.1 MB" defaultValue={editing?.size} />
              </label>
            </div>
            <label>
              说明
              <input name="description" defaultValue={editing?.description} />
            </label>
            <label>
              标签（逗号分隔）
              <input name="tags" placeholder="第 10 周, 课件" defaultValue={editing?.tags.join('，')} />
            </label>
            <div className="composer-actions">
              <button type="button" className="outline-action" onClick={() => openComposer(null)}>
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
