import { useEffect, useRef, useState } from 'react'
import { uid } from '../data/store'
import { inferMajorFromText, type Course } from '../data/types'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'

const weekDays = ['周一', '周二', '周三', '周四', '周五']
const sections = ['1–2 节', '3–4 节', '5–6 节', '7–8 节']
const sectionTimes = ['08:00–09:40', '10:00–11:40', '14:00–15:40', '16:00–17:40']

type Draft = {
  id: string
  name: string
  className: string
  students: string
  currentWeek: string
  totalWeeks: string
  day: string
  section: string
  room: string
}

type ContextMenuState = {
  courseId: string
  x: number
  y: number
}

function toDraft(course?: Course): Draft {
  const session = course?.sessions[0]
  return {
    id: course?.id ?? '',
    name: course?.name ?? '',
    className: course?.className ?? '',
    students: String(course?.students ?? 40),
    currentWeek: String(course?.currentWeek ?? 1),
    totalWeeks: String(course?.totalWeeks ?? 16),
    day: String(session?.day ?? 0),
    section: String(session?.section ?? 0),
    room: session?.room ?? '',
  }
}

function progressPct(course: Course) {
  if (course.totalWeeks > 0) return Math.round((course.currentWeek / course.totalWeeks) * 100)
  return course.progress
}

type Props = {
  courses: Course[]
  onChange: (courses: Course[]) => void
}

export function CoursesPage({ courses, onChange }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const editing = Boolean(draft?.id)
  const contextCourse = contextMenu ? courses.find((course) => course.id === contextMenu.courseId) : null

  useEffect(() => {
    if (!contextMenu) return
    const closeMenu = () => setContextMenu(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('pointerdown', closeMenu)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', closeMenu, true)
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

  const openCreate = (slot?: { day: number; section: number }) => {
    setContextMenu(null)
    const base = toDraft()
    setDraft(
      slot
        ? { ...base, day: String(slot.day), section: String(slot.section) }
        : base,
    )
  }

  const openEdit = (course: Course) => {
    setContextMenu(null)
    setDraft(toDraft(course))
  }

  const close = () => setDraft(null)

  const openCourseMenu = (event: React.MouseEvent, courseId: string) => {
    event.preventDefault()
    setContextMenu({ courseId, x: event.clientX, y: event.clientY })
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft?.name.trim()) return

    const existing = draft.id ? courses.find((course) => course.id === draft.id) : undefined
    const currentWeek = Math.min(
      Math.max(1, Number(draft.currentWeek) || 1),
      Math.max(1, Number(draft.totalWeeks) || 16),
    )
    const totalWeeks = Math.max(currentWeek, Number(draft.totalWeeks) || 16)
    const progress = Math.round((currentWeek / totalWeeks) * 100)
    const day = Number(draft.day)
    const section = Number(draft.section)
    const room = draft.room.trim() || '待定教室'
    const sessions = Number.isFinite(day) && Number.isFinite(section) ? [{ day, section, room }] : []
    const className = draft.className.trim() || '待定班级'
    const name = draft.name.trim()

    const next: Course = {
      id: draft.id || uid('course'),
      name,
      code: existing?.code || 'EDU000',
      className,
      students: Math.max(0, Number(draft.students) || 0),
      credits: existing?.credits ?? 2,
      major: existing?.major ?? inferMajorFromText(`${className} ${name}`),
      description: existing?.description,
      topic: existing?.topic || '待补充教学主题',
      currentWeek,
      totalWeeks,
      progress,
      weeks: `第 1–${totalWeeks} 周`,
      status: progress >= 50 ? '正常' : '待更新',
      color: existing?.color ?? 'teal',
      sessions,
    }

    onChange(draft.id ? courses.map((course) => (course.id === draft.id ? next : course)) : [...courses, next])
    notify.success(draft.id ? `已保存「${next.name}」` : `已创建「${next.name}」`)
    close()
  }

  const removeById = async (id: string) => {
    const item = courses.find((course) => course.id === id)
    if (!item) return
    try {
      await confirm.delete(`确定删除「${item.name}」？`)
    } catch {
      return
    }
    onChange(courses.filter((course) => course.id !== id))
    notify.warning(`已删除：${item.name}`, '已删除')
    setContextMenu(null)
    if (draft?.id === id) close()
  }

  const remove = () => {
    if (!draft?.id) return
    removeById(draft.id)
  }

  return (
    <section className="courses-page courses-page-simple" aria-label="课程与排课">
      <div className="page-actions">
        <button type="button" className="primary-action" onClick={openCreate}>
          ＋ 新建课程
        </button>
      </div>

      <div className="course-card-grid">
        {courses.map((course) => {
          const pct = progressPct(course)
          const session = course.sessions[0]
          return (
            <article
              className={`course-overview-card${contextMenu?.courseId === course.id ? ' is-menu-open' : ''}`}
              key={course.id}
              onContextMenu={(event) => openCourseMenu(event, course.id)}
            >
              <div className="course-overview-main">
                <div className="course-overview-head">
                  <h3>{course.name}</h3>
                </div>
                <div className="course-overview-meta">
                  <span>{course.className}</span>
                  <span>{course.students} 人</span>
                </div>
                <div className="course-overview-meta">
                  <span>
                    {session
                      ? `${weekDays[session.day]} ${sections[session.section]} · ${session.room}`
                      : '暂未排课'}
                  </span>
                </div>
                <div className="course-overview-progress">
                  <div>
                    <span>教学进度</span>
                    <strong>
                      {course.currentWeek}/{course.totalWeeks} 周（{pct}%）
                    </strong>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            </article>
          )
        })}
        {courses.length === 0 && <div className="course-empty">暂无课程，点击右上角新建</div>}
      </div>

      <section className="week-overview" aria-label="总周课表">
        <div className="week-overview-head">
          <h2>周课表</h2>
        </div>
        <table className="week-overview-table">
          <thead>
            <tr>
              <th>节次</th>
              {weekDays.map((day) => (
                <th key={day}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section, sectionIndex) => (
              <tr key={section}>
                <td>
                  {section}
                  <br />
                  <small>{sectionTimes[sectionIndex]}</small>
                </td>
                {weekDays.map((_, day) => {
                  const hit = courses.find((course) =>
                    course.sessions.some((item) => item.day === day && item.section === sectionIndex),
                  )
                  const session = hit?.sessions.find((item) => item.day === day && item.section === sectionIndex)
                  return (
                    <td
                      key={`${section}-${day}`}
                      className={hit ? 'week-cell has-course' : 'week-cell is-empty'}
                      onDoubleClick={() => {
                        if (!hit) openCreate({ day, section: sectionIndex })
                      }}
                      onContextMenu={(event) => {
                        if (!hit) return
                        openCourseMenu(event, hit.id)
                      }}
                    >
                      {hit && session ? (
                        <div
                          className={`week-slot week-slot-btn ${hit.major}${contextMenu?.courseId === hit.id ? ' is-menu-open' : ''}`}
                        >
                          <b>{hit.name}</b>
                          <span>
                            {hit.className}
                            <br />
                            {session.room}
                          </span>
                        </div>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {contextMenu && contextCourse && (
        <div
          ref={menuRef}
          className="task-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={`课程操作：${contextCourse.name}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => openEdit(contextCourse)}>
            编辑
          </button>
          <button type="button" role="menuitem" className="is-danger" onClick={() => removeById(contextCourse.id)}>
            删除
          </button>
        </div>
      )}

      {draft && (
        <div className="courses-modal-backdrop" onMouseDown={close}>
          <form
            className="courses-composer courses-composer-wide"
            onSubmit={save}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <p className="section-label">{editing ? '编辑课程' : '新建课程'}</p>
              <h2>{editing ? '保存后同步到日程与周课表' : '一门课 · 一个时段'}</h2>
            </div>

            <label>
              课程名称
              <input
                required
                autoFocus
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>

            <div className="composer-grid">
              <label>
                班级
                <input
                  value={draft.className}
                  onChange={(event) => setDraft({ ...draft, className: event.target.value })}
                  placeholder="例如：教育学 2024-1 班"
                />
              </label>
              <label>
                人数
                <input
                  value={draft.students}
                  onChange={(event) => setDraft({ ...draft, students: event.target.value })}
                />
              </label>
            </div>

            <div className="composer-grid">
              <label>
                当前周
                <input
                  value={draft.currentWeek}
                  onChange={(event) => setDraft({ ...draft, currentWeek: event.target.value })}
                />
              </label>
              <label>
                总周数
                <input
                  value={draft.totalWeeks}
                  onChange={(event) => setDraft({ ...draft, totalWeeks: event.target.value })}
                />
              </label>
            </div>

            <fieldset className="course-session-fields">
              <legend>上课时段</legend>
              <div className="composer-grid">
                <label>
                  星期
                  <select value={draft.day} onChange={(event) => setDraft({ ...draft, day: event.target.value })}>
                    {weekDays.map((day, index) => (
                      <option value={index} key={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  节次
                  <select
                    value={draft.section}
                    onChange={(event) => setDraft({ ...draft, section: event.target.value })}
                  >
                    {sections.map((section, index) => (
                      <option value={index} key={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                教室
                <input
                  value={draft.room}
                  onChange={(event) => setDraft({ ...draft, room: event.target.value })}
                  placeholder="文科楼 205"
                />
              </label>
            </fieldset>

            <div className={`composer-actions${editing ? ' composer-actions-split' : ''}`}>
              {editing && (
                <button type="button" className="danger-action" onClick={remove}>
                  删除
                </button>
              )}
              <div className="composer-actions-right">
                <button type="button" className="outline-action" onClick={close}>
                  取消
                </button>
                <button type="submit" className="primary-action">
                  保存
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
