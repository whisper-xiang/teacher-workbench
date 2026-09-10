import { useEffect, useState } from 'react'
import '../courses.css'
import '../daily-work.css'
import { uid } from '../data/store'
import { inferMajorFromText, type Course } from '../data/types'
import { courseClassLabel, ensureCourseClasses } from '../lib/course-classes'
import { currentCourseTopic, formatSession, SECTIONS, SECTION_TIMES, topicsFromText, topicsToText, WEEK_DAYS } from '../lib/courses'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'
import { CourseDetailPanel } from './CourseDetailPanel'

type SessionDraft = { day: string; section: string; room: string }

type Draft = {
  id: string
  name: string
  code: string
  className: string
  students: string
  credits: string
  currentWeek: string
  totalWeeks: string
  weeklyTopics: string
  sessions: SessionDraft[]
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
  initialCourseId?: string
  onChange: (courses: Course[]) => void
  onSelectCourse?: (courseId: string) => void
  onOpenStudents?: (courseId: string) => void
  onOpenResources?: (courseId: string) => void
}

export function CoursesPage({
  courses,
  initialCourseId,
  onChange,
  onSelectCourse,
  onOpenStudents,
  onOpenResources,
}: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const editing = Boolean(draft?.id)

  useEffect(() => {
    if (!draft) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDraft(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft])

  const openCreate = (slot?: { day: number; section: number }) => setDraft(toDraft(undefined, slot))
  const openEdit = (course: Course) => setDraft(toDraft(course))
  const close = () => setDraft(null)

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
    const studentCount = Math.max(0, Number(draft.students) || 0)
    const id = draft.id || uid('course')
    const existingClasses = existing ? ensureCourseClasses(existing) : []
    const classes =
      existingClasses.length > 1
        ? existingClasses.map((item, index) =>
            index === 0 ? { ...item, name: className, studentCount, currentWeek } : item,
          )
        : [
            {
              id: existingClasses[0]?.id || `${id}-class-1`,
              name: className,
              studentCount,
              currentWeek,
              nodes: existingClasses[0]?.nodes ?? [],
              performances: existingClasses[0]?.performances,
            },
          ]

    const next: Course = {
      id,
      name,
      code: draft.code.trim() || existing?.code || 'EDU000',
      className,
      students: classes.reduce((sum, item) => sum + item.studentCount, 0),
      credits: Math.max(0.5, Number(draft.credits) || existing?.credits || 2),
      major: existing?.major ?? inferMajorFromText(`${className} ${name}`),
      description: existing?.description,
      topic,
      weeklyTopics,
      currentWeek,
      totalWeeks,
      progress,
      weeks: `第 1–${totalWeeks} 周`,
      status: existing?.status ?? (progress >= 50 ? '正常' : '待更新'),
      color: existing?.color ?? 'teal',
      sessions,
      classes,
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
    if (draft?.id === id) close()
    if (initialCourseId === id) onSelectCourse?.('')
  }

  const updateSession = (index: number, patch: Partial<SessionDraft>) => {
    if (!draft) return
    setDraft({
      ...draft,
      sessions: draft.sessions.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    })
  }

  const composer = draft ? (
    <div className="courses-modal-backdrop" onMouseDown={close}>
      <form
        className="courses-composer courses-composer-wide"
        onSubmit={save}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div>
          <h2>{editing ? '编辑课程' : '新建课程'}</h2>
          <p>保存后同步到周课表与日程。</p>
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
          周教学主题（每行一周）
          <textarea
            rows={6}
            value={draft.weeklyTopics}
            onChange={(event) => setDraft({ ...draft, weeklyTopics: event.target.value })}
            placeholder={'学习动机理论\n期中复习与学习动机\n课堂管理中的动机策略'}
          />
        </label>

        <fieldset className="course-session-fields">
          <legend>上课时段</legend>
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
                  onClick={() => setDraft({ ...draft, sessions: draft.sessions.filter((_, i) => i !== index) })}
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
            加一时段
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
  ) : null

  const selected = initialCourseId ? courses.find((course) => course.id === initialCourseId) : undefined
  if (selected) {
    return (
      <>
        <CourseDetailPanel
          key={selected.id}
          course={selected}
          onBack={() => onSelectCourse?.('')}
          onEdit={() => openEdit(selected)}
          onOpenStudents={onOpenStudents ? () => onOpenStudents(selected.id) : undefined}
          onOpenResources={onOpenResources ? () => onOpenResources(selected.id) : undefined}
          onChangeCourse={(course) => onChange(courses.map((item) => (item.id === course.id ? course : item)))}
        />
        {composer}
      </>
    )
  }

  return (
    <section className="courses-page" aria-label="课程">
      <div className="courses-heading">
        <div>
          <h1>课程</h1>
          <p>排进课表，记下本周教什么。</p>
        </div>
        <button type="button" className="primary-action" onClick={() => openCreate()}>
          新建
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="course-empty">
          还没有课程。
          <button type="button" className="text-action" onClick={() => openCreate()}>
            新建一门
          </button>
        </div>
      ) : (
        <ul className="course-ledger">
          {courses.map((course) => {
            const topic = currentCourseTopic(course)
            const pct = progressPct(course)
            return (
              <li key={course.id}>
                <button type="button" className="course-ledger-row" onClick={() => onSelectCourse?.(course.id)}>
                  <div className="course-ledger-copy">
                    <h2>{course.name}</h2>
                    <p>{topic || '本周主题未写'}</p>
                    <span>
                      {course.sessions.length
                        ? course.sessions.map((session) => formatSession(session)).join('  ')
                        : '暂未排课'}
                    </span>
                  </div>
                  <div className="course-ledger-week" aria-label={`第 ${course.currentWeek} 周，进度 ${pct}%`}>
                    <strong>{course.currentWeek}</strong>
                    <small>/{course.totalWeeks}</small>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <section className="week-overview" aria-label="周课表">
        <div className="week-overview-head">
          <h2>周课表</h2>
          <p>点格子进课，空格双击排课。</p>
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
                  const hits = courses.flatMap((course) =>
                    course.sessions
                      .filter((item) => item.day === day && item.section === sectionIndex)
                      .map((session) => ({ course, session })),
                  )
                  return (
                    <td
                      key={`${section}-${day}`}
                      className={hits.length ? 'week-cell has-course' : 'week-cell is-empty'}
                      onDoubleClick={() => {
                        if (!hits.length) openCreate({ day, section: sectionIndex })
                      }}
                    >
                      {hits.map(({ course, session }) => (
                        <button
                          type="button"
                          key={`${course.id}-${session.day}-${session.section}`}
                          className="week-slot week-slot-btn"
                          onClick={() => onSelectCourse?.(course.id)}
                        >
                          <b>{course.name}</b>
                          <span>
                            {courseClassLabel(course)}
                            <br />
                            {session.room}
                          </span>
                        </button>
                      ))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {composer}
    </section>
  )
}
