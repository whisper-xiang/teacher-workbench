import { useState } from 'react'
import { uid } from '../data/store'
import { CLASS_NODE_KINDS, type Assignment, type ClassNodeKind, type Course, type CourseClassGroup, type StudentRecord, type TeachingResource } from '../data/types'
import { classProgressPct, ensureCourseClasses } from '../lib/course-classes'
import { confirm } from '../lib/confirm'
import { notify } from '../lib/notify'
import {
  deleteResourceFile,
  formatFileSize,
  inferResourceFormat,
  openStoredFile,
  putResourceFile,
} from '../lib/resource-files'
import { CourseStudioPanel } from './CourseStudioPanel'

const RESOURCE_TYPES = ['课件', '教案', '试题', '视频', '文献'] as const

type Props = {
  course: Course
  resources: TeachingResource[]
  students?: StudentRecord[]
  assignments?: Assignment[]
  onChangeCourse: (course: Course) => void
  onChangeResources: (resources: TeachingResource[]) => void
  onChangeAssignments?: (assignments: Assignment[]) => void
  onBack: () => void
  onOpenStudents?: () => void
  onOpenLibrary?: () => void
}

type NodeDraft = { week: string; kind: ClassNodeKind; note: string }
type ClassDraft = { name: string; studentCount: string; currentWeek: string }
type ResourceDraft = { title: string; type: TeachingResource['type']; description: string }

const emptyNode = (week: number): NodeDraft => ({ week: String(week), kind: '进度', note: '' })

export function CourseDetailPanel({
  course,
  resources,
  students = [],
  assignments = [],
  onChangeCourse,
  onChangeResources,
  onChangeAssignments,
  onBack,
  onOpenStudents,
  onOpenLibrary,
}: Props) {
  const classes = ensureCourseClasses(course)
  const courseResources = resources.filter((item) => item.course === course.name)
  const libraryCandidates = resources.filter((item) => item.course !== course.name)

  const [activeClassId, setActiveClassId] = useState(classes[0]?.id ?? '')
  const [nodeDraft, setNodeDraft] = useState<NodeDraft>(emptyNode(classes[0]?.currentWeek || course.currentWeek))
  const [classDraft, setClassDraft] = useState<ClassDraft | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<TeachingResource | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft>({ title: '', type: '课件', description: '' })

  const activeClass = classes.find((item) => item.id === activeClassId) ?? classes[0]

  const patchClasses = (nextClasses: CourseClassGroup[]) => {
    const first = nextClasses[0]
    onChangeCourse({
      ...course,
      classes: nextClasses,
      className: first?.name || course.className,
      students: nextClasses.reduce((sum, item) => sum + item.studentCount, 0) || course.students,
      currentWeek: first?.currentWeek ?? course.currentWeek,
    })
  }

  const patchClass = (classId: string, patch: Partial<CourseClassGroup>) => {
    patchClasses(classes.map((item) => (item.id === classId ? { ...item, ...patch } : item)))
  }

  const addClass = (event: React.FormEvent) => {
    event.preventDefault()
    if (!classDraft?.name.trim()) return
    const next: CourseClassGroup = {
      id: uid('class'),
      name: classDraft.name.trim(),
      studentCount: Math.max(0, Number(classDraft.studentCount) || 0),
      currentWeek: Math.max(1, Number(classDraft.currentWeek) || 1),
      nodes: [],
      performances: [],
    }
    patchClasses([...classes, next])
    setActiveClassId(next.id)
    setClassDraft(null)
    notify.success(`已添加班级「${next.name}」`)
  }

  const removeClass = async (item: CourseClassGroup) => {
    if (classes.length <= 1) {
      notify.warning('至少保留一个班级')
      return
    }
    try {
      await confirm.delete(`确定移除班级「${item.name}」？`)
    } catch {
      return
    }
    const next = classes.filter((row) => row.id !== item.id)
    patchClasses(next)
    if (activeClassId === item.id) setActiveClassId(next[0]?.id ?? '')
    notify.warning(`已移除：${item.name}`, '已删除')
  }

  const addNode = (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeClass || !nodeDraft.note.trim()) {
      notify.warning('请填写节点说明')
      return
    }
    const week = Math.max(1, Number(nodeDraft.week) || 1)
    patchClass(activeClass.id, {
      nodes: [
        {
          id: uid('node'),
          week,
          kind: nodeDraft.kind,
          note: nodeDraft.note.trim(),
          markedAt: new Date().toISOString(),
        },
        ...activeClass.nodes,
      ],
      currentWeek: Math.max(activeClass.currentWeek, week),
    })
    setNodeDraft(emptyNode(week))
    notify.success(`已记下${activeClass.name}第 ${week} 周「${nodeDraft.kind}」`)
  }

  const removeNode = (classId: string, nodeId: string) => {
    const target = classes.find((item) => item.id === classId)
    if (!target) return
    patchClass(classId, { nodes: target.nodes.filter((item) => item.id !== nodeId) })
  }

  const openResource = async (item: TeachingResource) => {
    if (!item.fileId) {
      notify.info(`「${item.title}」还没有上传文件`)
      setEditingResource(item)
      setResourceDraft({ title: item.title, type: item.type, description: item.description })
      setPendingFile(null)
      return
    }
    try {
      await openStoredFile(item.fileId)
      onChangeResources(
        resources.map((row) =>
          row.id === item.id ? { ...row, usedCount: (row.usedCount ?? 0) + 1, lastUsed: '刚刚' } : row,
        ),
      )
      notify.success(`已打开「${item.title}」`)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '无法打开文件')
    }
  }

  const bindResource = (item: TeachingResource) => {
    onChangeResources(resources.map((row) => (row.id === item.id ? { ...row, course: course.name } : row)))
    notify.success(`已把「${item.title}」关联到本课`)
    setPickerOpen(false)
  }

  const saveResource = async (event: React.FormEvent) => {
    event.preventDefault()
    const existing = editingResource
    const id = existing?.id || uid('res')
    let fileId = existing?.fileId
    let fileName = existing?.fileName
    let mimeType = existing?.mimeType
    let size = existing?.size ?? '—'
    let format = existing?.format ?? '其他'
    if (pendingFile) {
      const nextFileId = fileId || uid('file')
      try {
        await putResourceFile(nextFileId, pendingFile, pendingFile.name)
      } catch (error) {
        notify.error(error instanceof Error ? error.message : '文件保存失败')
        return
      }
      fileId = nextFileId
      fileName = pendingFile.name
      mimeType = pendingFile.type
      size = formatFileSize(pendingFile.size)
      format = inferResourceFormat(pendingFile.name, pendingFile.type)
    }
    const next: TeachingResource = {
      id,
      title: resourceDraft.title.trim() || fileName || '未命名资源',
      course: course.name,
      type: resourceDraft.type,
      updated: '刚刚',
      size,
      accent: existing?.accent ?? 'teal',
      description: resourceDraft.description.trim() || '本课教学资源。',
      tags: existing?.tags ?? ['本课'],
      major: course.major,
      format,
      usedCount: existing?.usedCount,
      lastUsed: existing?.lastUsed,
      fileId,
      fileName,
      mimeType,
    }
    onChangeResources(existing ? resources.map((item) => (item.id === existing.id ? next : item)) : [next, ...resources])
    notify.success(existing ? `已更新「${next.title}」` : `已保存「${next.title}」`)
    setEditingResource(null)
    setUploadOpen(false)
    setPendingFile(null)
  }

  const removeResource = async (item: TeachingResource) => {
    try {
      await confirm.delete(`确定删除「${item.title}」？`)
    } catch {
      return
    }
    if (item.fileId) await deleteResourceFile(item.fileId).catch(() => undefined)
    onChangeResources(resources.filter((row) => row.id !== item.id))
    notify.warning(`已删除：${item.title}`, '已删除')
  }

  return (
    <section className="courses-page courses-page-simple course-detail-panel" aria-label={`${course.name} 课程档案`}>
      <div className="course-detail-nav">
        <button type="button" className="text-action" onClick={onBack}>
          ← 返回课程门类
        </button>
        <div className="course-detail-nav-actions">
          {onOpenStudents && (
            <button type="button" className="outline-action" onClick={onOpenStudents}>
              学生与评价
            </button>
          )}
          {onOpenLibrary && (
            <button type="button" className="outline-action" onClick={onOpenLibrary}>
              打开资源库
            </button>
          )}
        </div>
      </div>

      <div className="courses-heading">
        <div>
          <p className="section-label">日常工作 · 教学</p>
          <h1>{course.name}</h1>
          <p>
            {course.code} · {course.credits} 学分 · {classes.length} 个班级
          </p>
        </div>
      </div>

      <div className="course-detail-layout">
        <section className="settings-card course-class-card">
          <div className="course-class-head">
            <div>
              <p className="section-label">班级节点</p>
              <h2>进度、作业与课堂表现</h2>
            </div>
            <button type="button" className="outline-action" onClick={() => setClassDraft({ name: '', studentCount: '40', currentWeek: '1' })}>
              ＋ 添加班级
            </button>
          </div>

          <div className="students-course-tabs" role="tablist" aria-label="选择班级">
            {classes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activeClass?.id ? 'active' : ''}
                onClick={() => {
                  setActiveClassId(item.id)
                  setNodeDraft(emptyNode(item.currentWeek))
                }}
              >
                {item.name}
                <small>{item.currentWeek} 周</small>
              </button>
            ))}
          </div>

          {activeClass && (
            <>
              <div className="course-overview-progress">
                <div>
                  <span>{activeClass.name}进度</span>
                  <strong>
                    第 {activeClass.currentWeek}/{course.totalWeeks} 周（{classProgressPct(activeClass, course.totalWeeks)}%）
                  </strong>
                </div>
                <div className="progress-track">
                  <i style={{ width: `${classProgressPct(activeClass, course.totalWeeks)}%` }} />
                </div>
              </div>
              <label className="course-week-input">
                当前讲到第几周
                <input
                  type="number"
                  min={1}
                  max={course.totalWeeks}
                  value={activeClass.currentWeek}
                  onChange={(event) => patchClass(activeClass.id, { currentWeek: Math.max(1, Number(event.target.value) || 1) })}
                />
              </label>
              {classes.length > 1 && (
                <button type="button" className="text-action" onClick={() => removeClass(activeClass)}>
                  移除该班级
                </button>
              )}

              <form className="course-node-form" onSubmit={addNode}>
                <label>
                  周次
                  <input
                    type="number"
                    min={1}
                    max={course.totalWeeks}
                    value={nodeDraft.week}
                    onChange={(event) => setNodeDraft({ ...nodeDraft, week: event.target.value })}
                  />
                </label>
                <label>
                  类型
                  <select
                    value={nodeDraft.kind}
                    onChange={(event) => setNodeDraft({ ...nodeDraft, kind: event.target.value as ClassNodeKind })}
                  >
                    {CLASS_NODE_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="course-node-note">
                  说明
                  <input
                    value={nodeDraft.note}
                    onChange={(event) => setNodeDraft({ ...nodeDraft, note: event.target.value })}
                    placeholder="例如：已讲完动机理论；作业周五回收；讨论参与度一般"
                  />
                </label>
                <button className="primary-action" type="submit">
                  记下节点
                </button>
              </form>

              <ul className="course-node-list">
                {activeClass.nodes.map((node) => (
                  <li key={node.id}>
                    <span className="resource-type-pill">
                      第 {node.week} 周 · {node.kind}
                    </span>
                    <p>{node.note}</p>
                    <button type="button" className="text-action" onClick={() => removeNode(activeClass.id, node.id)}>
                      删除
                    </button>
                  </li>
                ))}
                {activeClass.nodes.length === 0 && <li className="work-empty-row">还没有节点，可记下进度、作业或学生表现</li>}
              </ul>
            </>
          )}
        </section>

        <section className="settings-card course-class-card">
          <div className="course-class-head">
            <div>
              <p className="section-label">本课资源</p>
              <h2>从资源库导入，可预览并编辑</h2>
            </div>
            <div className="course-detail-nav-actions">
              <button type="button" className="outline-action" onClick={() => setPickerOpen(true)}>
                从资源库选择
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  setEditingResource(null)
                  setResourceDraft({ title: '', type: '课件', description: '' })
                  setPendingFile(null)
                  setUploadOpen(true)
                }}
              >
                ＋ 上传
              </button>
            </div>
          </div>

          <ul className="course-resource-manage">
            {courseResources.map((item) => (
              <li key={item.id}>
                <span className="resource-type-pill">{item.type}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.fileName || '未上传文件'}
                    {item.size && item.size !== '—' ? ` · ${item.size}` : ''}
                  </small>
                </div>
                <div className="work-materials-actions">
                  <button type="button" className="text-action" onClick={() => openResource(item)}>
                    {item.fileId ? '预览' : '补传'}
                  </button>
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => {
                      setEditingResource(item)
                      setResourceDraft({ title: item.title, type: item.type, description: item.description })
                      setPendingFile(null)
                      setUploadOpen(true)
                    }}
                  >
                    编辑
                  </button>
                  <button type="button" className="text-action" onClick={() => removeResource(item)}>
                    删除
                  </button>
                </div>
              </li>
            ))}
            {courseResources.length === 0 && <li className="work-empty-row">本课还没有资源，可上传或从资源库选择</li>}
          </ul>
        </section>
      </div>

      {activeClass && (
        <CourseStudioPanel
          course={course}
          activeClass={activeClass}
          students={students}
          assignments={assignments}
          onChangeClass={(patch) => patchClass(activeClass.id, patch)}
          onChangeAssignments={onChangeAssignments ?? (() => undefined)}
          onOpenRoster={onOpenStudents}
        />
      )}

      {classDraft && (
        <div className="courses-modal-backdrop" onMouseDown={() => setClassDraft(null)}>
          <form className="courses-composer" onSubmit={addClass} onMouseDown={(event) => event.stopPropagation()}>
            <p className="section-label">添加班级</p>
            <h2>同一门课可带多个班级</h2>
            <label>
              班级名称
              <input
                required
                autoFocus
                value={classDraft.name}
                onChange={(event) => setClassDraft({ ...classDraft, name: event.target.value })}
                placeholder="例如：教育学 2024-2 班"
              />
            </label>
            <div className="composer-grid">
              <label>
                人数
                <input
                  value={classDraft.studentCount}
                  onChange={(event) => setClassDraft({ ...classDraft, studentCount: event.target.value })}
                />
              </label>
              <label>
                当前周
                <input
                  value={classDraft.currentWeek}
                  onChange={(event) => setClassDraft({ ...classDraft, currentWeek: event.target.value })}
                />
              </label>
            </div>
            <div className="composer-actions">
              <button type="button" className="outline-action" onClick={() => setClassDraft(null)}>
                取消
              </button>
              <button className="primary-action" type="submit">
                添加
              </button>
            </div>
          </form>
        </div>
      )}

      {pickerOpen && (
        <div className="courses-modal-backdrop" onMouseDown={() => setPickerOpen(false)}>
          <div className="courses-composer courses-composer-wide" onMouseDown={(event) => event.stopPropagation()}>
            <p className="section-label">资源库</p>
            <h2>选择已有资源关联到「{course.name}」</h2>
            <ul className="course-resource-manage">
              {libraryCandidates.map((item) => (
                <li key={item.id}>
                  <span className="resource-type-pill">{item.type}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.course}</small>
                  </div>
                  <button type="button" className="text-action" onClick={() => bindResource(item)}>
                    关联到本课
                  </button>
                </li>
              ))}
              {libraryCandidates.length === 0 && <li className="work-empty-row">资源库里没有其他可关联的条目</li>}
            </ul>
            <div className="composer-actions">
              <button type="button" className="outline-action" onClick={() => setPickerOpen(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadOpen && (
        <div
          className="courses-modal-backdrop"
          onMouseDown={() => {
            setUploadOpen(false)
            setEditingResource(null)
          }}
        >
          <form className="courses-composer" onSubmit={saveResource} onMouseDown={(event) => event.stopPropagation()}>
            <p className="section-label">{editingResource ? '编辑资源' : '上传到本课'}</p>
            <h2>{editingResource ? `修改「${editingResource.title}」` : '文件保存在本机资源库'}</h2>
            <label>
              标题
              <input
                required
                autoFocus
                value={resourceDraft.title}
                onChange={(event) => setResourceDraft({ ...resourceDraft, title: event.target.value })}
              />
            </label>
            <label>
              类型
              <select
                value={resourceDraft.type}
                onChange={(event) =>
                  setResourceDraft({ ...resourceDraft, type: event.target.value as TeachingResource['type'] })
                }
              >
                {RESOURCE_TYPES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              本地文件
              <input type="file" onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)} />
              <small>
                {pendingFile
                  ? `将保存 ${pendingFile.name}`
                  : editingResource?.fileName
                    ? `已有 ${editingResource.fileName}`
                    : '可选，上传后可在本页预览'}
              </small>
            </label>
            <label>
              说明
              <input
                value={resourceDraft.description}
                onChange={(event) => setResourceDraft({ ...resourceDraft, description: event.target.value })}
              />
            </label>
            <div className="composer-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => {
                  setUploadOpen(false)
                  setEditingResource(null)
                }}
              >
                取消
              </button>
              <button className="primary-action" type="submit">
                保存
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
