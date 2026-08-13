import { useEffect, useMemo, useRef, useState } from 'react'
import { uid } from '../data/store'
import type { Course, TeachingResource } from '../data/types'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'
import {
  deleteResourceFile,
  formatFileSize,
  inferResourceFormat,
  openStoredFile,
  putResourceFile,
} from '../lib/resource-files'

const RESOURCE_TYPES = ['课件', '教案', '试题', '视频', '文献'] as const

type ContextMenuState = {
  resourceId: string
  x: number
  y: number
}

type Props = {
  resources: TeachingResource[]
  courses: Course[]
  initialCourseId?: string
  onChangeResources: (resources: TeachingResource[]) => void
  onOpenCourse?: (courseId: string) => void
}

export function ResourcesPage({ resources, courses, initialCourseId, onChangeResources, onOpenCourse }: Props) {
  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState(initialCourseId ?? '')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editing, setEditing] = useState<TeachingResource | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const dropRef = useRef<HTMLElement | null>(null)

  const courseNames = courses.map((course) => course.name)
  const contextResource = contextMenu ? resources.find((item) => item.id === contextMenu.resourceId) : null
  const filterCourse = courses.find((course) => course.id === courseFilter)

  useEffect(() => {
    if (initialCourseId) setCourseFilter(initialCourseId)
  }, [initialCourseId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return resources.filter((item) => {
      if (filterCourse && item.course !== filterCourse.name) return false
      if (!q) return true
      return `${item.title}${item.course}${item.type}${item.description}${item.fileName ?? ''}`.toLowerCase().includes(q)
    })
  }, [resources, query, filterCourse])

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
    setPendingFile(null)
    setComposerOpen(true)
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setEditing(null)
    setPendingFile(null)
  }

  const markUsed = (item: TeachingResource) => {
    onChangeResources(
      resources.map((resource) =>
        resource.id === item.id
          ? { ...resource, usedCount: (resource.usedCount ?? 0) + 1, lastUsed: '刚刚', updated: resource.updated }
          : resource,
      ),
    )
  }

  const openFile = async (item: TeachingResource) => {
    setContextMenu(null)
    if (!item.fileId) {
      notify.info(`「${item.title}」还没有上传文件`)
      openComposer(item)
      return
    }
    try {
      await openStoredFile(item.fileId)
      markUsed(item)
      notify.success(`已打开「${item.title}」`)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '无法打开文件')
    }
  }

  const removeById = async (id: string) => {
    const item = resources.find((resource) => resource.id === id)
    if (!item) return
    try {
      await confirm.delete(`确定删除「${item.title}」？本地文件也会移除。`)
    } catch {
      return
    }
    if (item.fileId) await deleteResourceFile(item.fileId).catch(() => undefined)
    onChangeResources(resources.filter((resource) => resource.id !== id))
    notify.warning(`已删除：${item.title}`, '已删除')
    setContextMenu(null)
    if (editing?.id === id) closeComposer()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const courseName = String(form.get('course') || '').trim()
    const linked = courses.find((course) => course.name === courseName)
    const id = editing?.id || uid('res')
    let fileId = editing?.fileId
    let fileName = editing?.fileName
    let mimeType = editing?.mimeType
    let size = editing?.size ?? '—'
    let format = editing?.format ?? '其他'

    if (pendingFile) {
      const nextFileId = fileId || uid('file')
      try {
        await putResourceFile(nextFileId, pendingFile, pendingFile.name)
      } catch (error) {
        notify.error(error instanceof Error ? error.message : '文件保存失败')
        return
      }
      if (fileId && fileId !== nextFileId) await deleteResourceFile(fileId).catch(() => undefined)
      fileId = nextFileId
      fileName = pendingFile.name
      mimeType = pendingFile.type
      size = formatFileSize(pendingFile.size)
      format = inferResourceFormat(pendingFile.name, pendingFile.type)
    }

    const base: TeachingResource = {
      id,
      title: String(form.get('title') || '').trim() || fileName || '未命名资源',
      course: courseName || '未关联课程',
      type: String(form.get('type')) as TeachingResource['type'],
      updated: '刚刚',
      size,
      accent: editing?.accent ?? 'teal',
      description: String(form.get('description') || '').trim() || '本地保存的教学资源。',
      tags: editing?.tags ?? [],
      major: linked?.major ?? editing?.major,
      format,
      usedCount: editing?.usedCount,
      lastUsed: editing?.lastUsed,
      fileId,
      fileName,
      mimeType,
    }
    if (!base.title) return

    if (editing) {
      onChangeResources(resources.map((item) => (item.id === editing.id ? { ...item, ...base } : item)))
      notify.success(`已更新「${base.title}」`)
    } else {
      onChangeResources([base, ...resources])
      notify.success(fileId ? `已保存「${base.title}」到本机` : `已登记「${base.title}」`)
    }
    closeComposer()
  }

  return (
    <section
      className={`resources-page resources-page-simple${dragging ? ' is-dropping' : ''}`}
      aria-label="教学资源库"
      ref={dropRef}
      onDragEnter={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        const file = event.dataTransfer.files[0]
        if (!file) return
        setPendingFile(file)
        if (!composerOpen) openComposer(null)
      }}
    >
      <div className="resources-heading">
        <div>
          <p className="section-label">教学管理</p>
          <h1>教学资源库</h1>
          <p>文件保存在本机浏览器中，可绑定课程并标记已用</p>
        </div>
        <button type="button" className="primary-action" onClick={() => openComposer(null)}>
          ＋ 登记资源
        </button>
      </div>

      <div className="students-course-tabs" role="tablist" aria-label="按课程筛选">
        <button type="button" className={!courseFilter ? 'active' : ''} onClick={() => setCourseFilter('')}>
          全部
        </button>
        {courses.map((course) => (
          <button
            key={course.id}
            type="button"
            className={courseFilter === course.id ? 'active' : ''}
            onClick={() => setCourseFilter(course.id)}
          >
            {course.name}
            <small>{resources.filter((item) => item.course === course.name).length}</small>
          </button>
        ))}
      </div>

      <label className="resource-search-simple">
        <span>⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索标题、课程或文件名"
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
              <small>
                {item.course}
                {item.fileName ? ` · ${item.fileName}` : ' · 未上传文件'}
                {item.size && item.size !== '—' ? ` · ${item.size}` : ''}
                {item.usedCount ? ` · 用过 ${item.usedCount} 次` : ''}
              </small>
            </div>
            <div className="resource-row-actions">
              <button type="button" className="text-action" onClick={() => openFile(item)}>
                {item.fileId ? '打开' : '补传'}
              </button>
              <button type="button" className="text-action" onClick={() => openComposer(item)}>
                编辑
              </button>
            </div>
          </article>
        ))}
        {visible.length === 0 && (
          <div className="resource-empty-simple">
            {resources.length === 0 ? '把课件拖到这里，或点击右上角登记' : '没有匹配的资源'}
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
          <button type="button" role="menuitem" onClick={() => openFile(contextResource)}>
            打开文件
          </button>
          {onOpenCourse && courses.find((course) => course.name === contextResource.course) && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const course = courses.find((item) => item.name === contextResource.course)
                if (course) onOpenCourse(course.id)
                setContextMenu(null)
              }}
            >
              查看课程
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => openComposer(contextResource)}>
            编辑
          </button>
          <button type="button" role="menuitem" className="is-danger" onClick={() => removeById(contextResource.id)}>
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
              <h2>{editing ? `修改「${editing.title}」` : '保存到本机资源库'}</h2>
            </div>
            <label>
              标题
              <input name="title" required autoFocus defaultValue={editing?.title} placeholder="可与文件名不同" />
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
                <select name="course" defaultValue={editing?.course ?? filterCourse?.name ?? ''}>
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
            <label className="resource-file-field">
              本地文件
              <input
                type="file"
                onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)}
              />
              <small>
                {pendingFile
                  ? `将保存 ${pendingFile.name}（${formatFileSize(pendingFile.size)}）`
                  : editing?.fileName
                    ? `已有 ${editing.fileName}`
                    : '可选。也可把文件拖到页面上。'}
              </small>
            </label>
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
