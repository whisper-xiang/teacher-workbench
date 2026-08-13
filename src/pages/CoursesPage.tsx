import { useEffect, useRef, useState } from 'react'
import { uid } from '../data/store'
import { inferMajorFromText, type Course } from '../data/types'
import { currentCourseTopic, formatSession, SECTIONS, SECTION_TIMES, topicsFromText, topicsToText, WEEK_DAYS } from '../lib/courses'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'

type SessionDraft = { day: string; section: string; room: string }

type Draft = {
  id: string
  name: string
  code: string
  className: string
  students: string
  credits: string
  description: string
  currentWeek: string
  totalWeeks: string
  weeklyTopics: string
  sessions: SessionDraft[]
}

type ContextMenuState = {
  courseId: string
  x: number
  y: number
}

function emptySession(slot?: { day: number; section: number }): SessionDraft {
  return {
    day: String(slot?.day ?? 0),
    section: String(slot?.section ?? 0),
    room: '',
  }
}

function toDraft(course?: Course, slot?: { day: number; section: number }): Draft {
  const sessions =
    course?.sessions?.length
      ? course.sessions.map((item) => ({ day: String(item.day), section: String(item.section), room: item.room }))
      : [emptySession(slot)]
  return {
    id: course?.id ?? '',
    name: course?.name ?? '',
    code: course?.code ?? '',
    className: course?.className ?? '',
    students: String(course?.students ?? 40),
    credits: String(course?.credits ?? 2),
    description: course?.description ?? '',
    currentWeek: String(course?.currentWeek ?? 1),
    totalWeeks: String(course?.totalWeeks ?? 16),
    weeklyTopics: topicsToText(course?.weeklyTopics),
    sessions,
  }
}

function progressPct(course: Course) {
  if (course.totalWeeks > 0) return Math.round((course.currentWeek / course.totalWeeks) * 100)
  return course.progress
}

type Props = {
  courses: Course[]
  onChange: (courses: Course[]) => void
  onOpenStudents?: (courseId: string) => void
}

export function CoursesPage({ courses, onChange, onOpenStudents }: Props) {
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
    setDraft(toDraft(undefined, slot))
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
    const sessions = draft.sessions
      .map((item) => ({
        day: Number(item.day),
        section: Number(item.section),
        room: item.room.trim() || '待定教室',
      }))
      .filter((item) => Number.isFinite(item.day) && Number.isFinite(item.section))
      .filter((item, index, list) => list.findIndex((other) => other.day === item.day && other.section === item.section) === index)

    const className = draft.className.trim() || '待定班级'
    const name = draft.name.trim()
    const weeklyTopics = topicsFromText(draft.weeklyTopics, totalWeeks)
    const topic = currentCourseTopic({ weeklyTopics, topic: existing?.topic, currentWeek }) || '待补充教学主题'

    const next: Course = {
      id: draft.id || uid('course'),
      name,
      code: draft.code.trim() || existing?.code || 'EDU000',
      className,
      students: Math.max(0, Number(draft.students) || 0),
      credits: Math.max(0.5, Number(draft.credits) || existing?.credits || 2),
      major: existing?.major ?? inferMajorFromText(`${className} ${name}`),
      description: draft.description.trim() || existing?.description,
      topic,
      weeklyTopics,
      currentWeek,
      totalWeeks,
      progress,
      weeks: `第 1–${totalWeeks} 周`,
      status: existing?.status ?? (progress >= 50 ? '正常' : '待更新'),
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

  const updateSession = (index: number, patch: Partial<SessionDraft>) => {
    if (!draft) return
    setDraft({
      ...draft,
      sessions: draft.sessions.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    })
  }

  return (
    <section className="courses-page courses-page-simple" aria-label="课程与排课">
      <div className="courses-heading">
        <div>
          <p className="section-label">教学管理</p>
          <h1>课程与排课</h1>
          <p>一门课可排多个时段，周主题会同步到工作概览</p>
        </div>
        <button type="button" className="primary-action" onClick={() => openCreate()}>
          ＋ 新建课程
        </button>
      </div>

      <div className="course-card-grid">
        {courses.map((course) => {
          const pct = progressPct(course)
          const topic = currentCourseTopic(course)
          return (
            <article
              className={`course-overview-card${contextMenu?.courseId === course.id ? ' is-menu-open' : ''}`}
              key={course.id}
              onContextMenu={(event) => openCourseMenu(event, course.id)}
            >
              <div className="course-overview-main">
                <div className="course-overview-head">
                  <h3>{course.name}</h3>
                  <span className="course-code">{course.code}</span>
                </div>
                <div className="course-overview-meta">
                  <span>{course.className}</span>
                  <span>{course.students} 人</span>
                  <span>{course.credits} 学分</span>
                </div>
                <div className="course-overview-meta course-overview-sessions">
                  {course.sessions.length
                    ? course.sessions.map((session, index) => <span key={`${session.day}-${session.section}-${index}`}>{formatSession(session)}</span>)
                    : <span>暂未排课</span>}
                </div>
                {topic && <p className="course-overview-topic">本周：{topic}</p>}
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
                <div className="course-overview-actions">
                  <button type="button" className="text-action" onClick={() => openEdit(course)}>
                    编辑档案
                  </button>
                  {onOpenStudents && (
                    <button type="button" className="text-action" onClick={() => onOpenStudents(course.id)}>
                      学生与评价
                    </button>
                  )}
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
              {WEEK_DAYS.map((day) => (
                <th key={day}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((section, sectionIndex) => (
              <tr key={section}>
                <td>
                  {section}
                  <br />
                  <small>{SECTION_TIMES[sectionIndex]}</small>
                </td>
                {WEEK_DAYS.map((_, day) => {
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
            编辑档案
          </button>
          {onOpenStudents && (
            <button type="button" role="menuitem" onClick={() => onOpenStudents(contextCourse.id)}>
              学生与评价
            </button>
          )}
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
              <h2>{editing ? '保存后同步到日程与周课表' : '课程档案 · 可排多个时段'}</h2>
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
                课程编号
                <input
                  value={draft.code}
                  onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                  placeholder="例如：EDU203"
                />
              </label>
              <label>
                学分
                <input
                  value={draft.credits}
                  onChange={(event) => setDraft({ ...draft, credits: event.target.value })}
                />
              </label>
            </div>

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

            <label>
              课程简介
              <input
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="一句话说明这门课"
              />
            </label>

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

            <label>
              周教学主题（每行一周，第 1 行即第 1 周）
              <textarea
                rows={6}
                value={draft.weeklyTopics}
                onChange={(event) => setDraft({ ...draft, weeklyTopics: event.target.value })}
                placeholder={'学习动机理论\n期中复习与学习动机\n课堂管理中的动机策略'}
              />
            </label>

            <fieldset className="course-session-fields">
              <legend>上课时段（可多个）</legend>
              {draft.sessions.map((session, index) => (
                <div className="course-session-row" key={index}>
                  <label>
                    星期
                    <select value={session.day} onChange={(event) => updateSession(index, { day: event.target.value })}>
                      {WEEK_DAYS.map((day, dayIndex) => (
                        <option value={dayIndex} key={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    节次
                    <select
                      value={session.section}
                      onChange={(event) => updateSession(index, { section: event.target.value })}
                    >
                      {SECTIONS.map((section, sectionIndex) => (
                        <option value={sectionIndex} key={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    教室
                    <input
                      value={session.room}
                      onChange={(event) => updateSession(index, { room: event.target.value })}
                      placeholder="文科楼 205"
                    />
                  </label>
                  {draft.sessions.length > 1 && (
                    <button
                      type="button"
                      className="text-action"
                      onClick={() =>
                        setDraft({ ...draft, sessions: draft.sessions.filter((_, i) => i !== index) })
                      }
                    >
                      移除
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-action"
                onClick={() => setDraft({ ...draft, sessions: [...draft.sessions, emptySession()] })}
              >
                ＋ 加一时段
              </button>
            </fieldset>

            <div className={`composer-actions${editing ? ' composer-actions-split' : ''}`}>
              {editing && (
                <button type="button" className="danger-action" onClick={() => draft.id && removeById(draft.id)}>
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
