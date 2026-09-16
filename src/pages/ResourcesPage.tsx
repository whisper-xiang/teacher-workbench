import { useEffect, useMemo, useRef, useState } from 'react'
import '../components/course-tabs.css'
import '../resources.css'
import { uid } from '../data/store'
import type { Course, TeachingResource } from '../data/types'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'
import {
  deleteResourceFile,
  formatFileSize,
  inferResourceFormat,
  inferResourceType,
  openStoredFile,
  putResourceFile,
} from '../lib/resource-files'

const RESOURCE_TYPES = ['课件', '教案', '试题', '视频', '文献'] as const

type ResourceType = (typeof RESOURCE_TYPES)[number]

type Props = {
  resources: TeachingResource[]
  courses: Course[]
  initialCourseId?: string
  onChangeResources: (resources: TeachingResource[]) => void
}

function fileTitle(name: string) {
  return name.replace(/\.[^.]+$/, '').trim() || name
}

export function ResourcesPage({ resources, courses, initialCourseId, onChangeResources }: Props) {
  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState(initialCourseId ?? '')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editing, setEditing] = useState<TeachingResource | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ResourceType>('课件')
  const [courseName, setCourseName] = useState('')
  const [dragging, setDragging] = useState(false)
  const dropRef = useRef<HTMLElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const courseNames = courses.map((course) => course.name)
  const filterCourse = courses.find((course) => course.id === courseFilter)
  const filed = useMemo(() => resources.filter((item) => item.fileId), [resources])

  useEffect(() => {
    if (initialCourseId) setCourseFilter(initialCourseId)
  }, [initialCourseId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return filed.filter((item) => {
      if (filterCourse && item.course !== filterCourse.name) return false
      if (!q) return true
      return `${item.title}${item.course}${item.type}${item.fileName ?? ''}`.toLowerCase().includes(q)
    })
  }, [filed, query, filterCourse])

  const applyFile = (file: File, keepTitle: boolean) => {
    setPendingFile(file)
    setType(inferResourceType(file.name, file.type))
    if (!keepTitle) setTitle(fileTitle(file.name))
  }

  const openComposer = (item: TeachingResource | null, file?: File | null) => {
    setEditing(item)
    if (item) {
      setTitle(item.title)
      setType(item.type)
      setCourseName(item.course === '未关联课程' ? '' : item.course)
      if (file) applyFile(file, true)
      else setPendingFile(null)
    } else {
      setCourseName(filterCourse?.name ?? '')
      if (file) applyFile(file, false)
      else {
        setPendingFile(null)
        setTitle('')
        setType('课件')
      }
    }
    setComposerOpen(true)
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setEditing(null)
    setPendingFile(null)
    setTitle('')
    setType('课件')
    setCourseName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const openFile = async (item: TeachingResource) => {
    if (!item.fileId) return
    try {
      await openStoredFile(item.fileId)
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
    if (editing?.id === id) closeComposer()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const linked = courses.find((course) => course.name === courseName)
    const id = editing?.id || uid('res')
    let fileId = editing?.fileId
    let fileName = editing?.fileName
    let mimeType = editing?.mimeType
    let size = editing?.size ?? '—'
    let format = editing?.format ?? '其他'

    if (!pendingFile && !fileId) {
      notify.error('请先选择要保存的文件')
      return
    }

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

    const nextTitle = title.trim() || fileName || '未命名文件'
    const base: TeachingResource = {
      id,
      title: nextTitle,
      course: courseName || '未关联课程',
      type,
      updated: '刚刚',
      size,
      accent: editing?.accent ?? 'teal',
      description: editing?.description ?? '',
      tags: editing?.tags ?? [],
      major: linked?.major ?? editing?.major,
      format,
      fileId,
      fileName,
      mimeType,
    }

    if (editing) {
      onChangeResources(resources.map((item) => (item.id === editing.id ? { ...item, ...base } : item)))
      notify.success(`已更新「${base.title}」`)
    } else {
      onChangeResources([base, ...resources.filter((item) => item.fileId)])
      notify.success(`已保存「${base.title}」`)
    }
    closeComposer()
  }

  const emptyCopy = () => {
    if (filed.length === 0) return '还没有文件。拖进来，或'
    if (query.trim()) return '没有匹配的文件'
    if (filterCourse) return `「${filterCourse.name}」还没有文件`
    return '没有匹配的文件'
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
        if (composerOpen) {
          applyFile(file, Boolean(editing) || Boolean(title.trim()))
          return
        }
        openComposer(null, file)
      }}
    >
      <div className="resources-heading">
        <div>
          <p className="section-label">日常工作</p>
          <h1>教学资源库</h1>
          <p>文件只保存在这个浏览器。按课放入，下次打开</p>
        </div>
        <div className="students-heading-actions">
          <button type="button" className="primary-action" onClick={() => openComposer(null)}>
            ＋ 添加
          </button>
        </div>
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
            <small>{filed.filter((item) => item.course === course.name).length}</small>
          </button>
        ))}
      </div>

      {filed.length > 0 && (
        <label className="resource-search-simple">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题或文件名"
            aria-label="搜索教学资源"
          />
        </label>
      )}

      <div className="resource-list-simple">
        {visible.map((item) => (
          <article key={item.id} className="resource-row">
            <span className="resource-type-pill">{item.type}</span>
            <div className="resource-row-body">
              <strong>{item.title}</strong>
              <small>
                {item.course}
                {item.fileName ? ` · ${item.fileName}` : ''}
                {item.size && item.size !== '—' ? ` · ${item.size}` : ''}
              </small>
            </div>
            <div className="resource-row-actions">
              <button type="button" className="text-action" onClick={() => void openFile(item)}>
                打开
              </button>
              <button type="button" className="text-action" onClick={() => openComposer(item)}>
                编辑
              </button>
            </div>
          </article>
        ))}
        {visible.length === 0 && (
          <div className="resource-empty-simple">
            {emptyCopy()}
            {!query.trim() && (
              <button type="button" className="text-action" onClick={() => openComposer(null)}>
                添加
              </button>
            )}
          </div>
        )}
      </div>

      {composerOpen && (
        <div className="resources-modal-backdrop" onMouseDown={closeComposer}>
          <form
            className="resources-composer"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div>
              <p className="section-label">{editing ? '编辑' : '放入文件'}</p>
              <h2>{editing ? `修改「${editing.title}」` : '保存到本机'}</h2>
            </div>
            <label className="resource-file-field">
              文件
              <input
                ref={fileRef}
                type="file"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) applyFile(file, Boolean(editing) || Boolean(title.trim()))
                  else if (!editing) setPendingFile(null)
                  event.target.value = ''
                }}
              />
              <span className="resource-file-row">
                <button type="button" className="outline-action" onClick={() => fileRef.current?.click()}>
                  {pendingFile || editing?.fileName ? '更换文件' : '选择文件'}
                </button>
                <small>
                  {pendingFile
                    ? `将保存 ${pendingFile.name}（${formatFileSize(pendingFile.size)}）`
                    : editing?.fileName
                      ? `已有 ${editing.fileName}`
                      : '必选。也可把文件拖到页面上。'}
                </small>
              </span>
            </label>
            <label>
              标题
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoFocus={!pendingFile}
                placeholder="默认同文件名"
              />
            </label>
            <div className="composer-grid">
              <label>
                类型
                <select value={type} onChange={(event) => setType(event.target.value as ResourceType)}>
                  {RESOURCE_TYPES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                课程
                <select value={courseName} onChange={(event) => setCourseName(event.target.value)}>
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
            <div className="composer-actions">
              {editing && (
                <button type="button" className="danger-action" onClick={() => void removeById(editing.id)}>
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
