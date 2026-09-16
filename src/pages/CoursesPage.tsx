import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import '../courses.css'
import { uid } from '../data/store'
import type { Course } from '../data/types'
import { confirm } from '../lib/confirm'
import {
  SECTIONS,
  SECTION_TIMES,
  WEEK_DAYS,
  createCourseFromSlot,
  currentCourseTopic,
  withWeekTopic,
} from '../lib/courses'
import { notify } from '../lib/notify'
import { TimetableImportDialog } from '../components/TimetableImportDialog'

type Props = {
  courses: Course[]
  weekNumber: number
  onChange: (courses: Course[]) => void
}

type Draft = {
  day: number
  section: number
  courseId?: string
  name: string
  room: string
  topic: string
}

function slotLabel(day: number, section: number) {
  return `${WEEK_DAYS[day] ?? '待定'} ${SECTIONS[section] ?? '时段'}`
}

export function CoursesPage({ courses, weekNumber, onChange }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [importing, setImporting] = useState(false)
  const editing = Boolean(draft?.courseId)

  useEffect(() => {
    if (!draft) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDraft(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft])

  const close = () => setDraft(null)

  const openCreate = (day: number, section: number) => {
    setDraft({ day, section, name: '', room: '', topic: '' })
  }

  const openEdit = (course: Course, day: number, section: number) => {
    const session = course.sessions.find((item) => item.day === day && item.section === section)
    setDraft({
      day,
      section,
      courseId: course.id,
      name: course.name,
      room: session?.room ?? '',
      topic: currentCourseTopic(course, weekNumber),
    })
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft) return
    const name = draft.name.trim()
    if (!name) return
    const room = draft.room.trim() || '待定教室'
    const topic = draft.topic.trim()

    if (draft.courseId) {
      const course = courses.find((item) => item.id === draft.courseId)
      if (!course) return
      const next = withWeekTopic(
        {
          ...course,
          name,
          sessions: course.sessions.map((item) =>
            item.day === draft.day && item.section === draft.section ? { ...item, room } : item,
          ),
        },
        weekNumber,
        topic,
      )
      onChange(courses.map((item) => (item.id === next.id ? next : item)))
      notify.success('已保存这一节')
      close()
      return
    }

    const existing = courses.find((item) => item.name === name)
    if (existing) {
      const taken = existing.sessions.some((item) => item.day === draft.day && item.section === draft.section)
      if (taken) {
        notify.warning('这门课已经排在这一格')
        return
      }
      const next = withWeekTopic(
        {
          ...existing,
          sessions: [...existing.sessions, { day: draft.day, section: draft.section, room }],
        },
        weekNumber,
        topic,
      )
      onChange(courses.map((item) => (item.id === next.id ? next : item)))
      notify.success(`已把「${name}」加到这一格`)
      close()
      return
    }

    const created = withWeekTopic(
      createCourseFromSlot({
        id: uid('course'),
        classId: uid('class'),
        name,
        day: draft.day,
        section: draft.section,
        room,
        weekNumber,
        topic,
      }),
      weekNumber,
      topic,
    )
    onChange([...courses, created])
    notify.success(`已排入「${name}」`)
    close()
  }

  const dropSlot = async () => {
    if (!draft?.courseId) return
    const course = courses.find((item) => item.id === draft.courseId)
    if (!course) return
    const remaining = course.sessions.filter(
      (item) => !(item.day === draft.day && item.section === draft.section),
    )
    if (remaining.length === 0) {
      try {
        await confirm.delete(`去掉后「${course.name}」会从课表里消失。`, '去掉这门课', {
          confirmButtonText: '去掉',
        })
      } catch {
        return
      }
      onChange(courses.filter((item) => item.id !== course.id))
      notify.warning(`已去掉「${course.name}」`)
      close()
      return
    }
    onChange(
      courses.map((item) => (item.id === course.id ? { ...item, sessions: remaining } : item)),
    )
    notify.success('已去掉这一格')
    close()
  }

  return (
    <section className="courses-page" aria-label="课表">
      <div className="courses-heading">
        <div>
          <h1>课表</h1>
          <p>点空格排课，点格子改这一节。也可导入课表。保存后整学期出现在日程。现在是第 {weekNumber} 周。</p>
        </div>
        <button type="button" className="outline-action" onClick={() => setImporting(true)}>
          导入课表
        </button>
      </div>

      <section className="week-overview" aria-label="周课表">
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
                <th scope="row">
                  {section}
                  <br />
                  <small>{SECTION_TIMES[sectionIndex]}</small>
                </th>
                {WEEK_DAYS.map((dayLabel, day) => {
                  const hits = courses.flatMap((course) =>
                    course.sessions
                      .filter((item) => item.day === day && item.section === sectionIndex)
                      .map((session) => ({ course, session })),
                  )
                  return (
                    <td
                      key={`${section}-${day}`}
                      className={hits.length ? 'week-cell has-course' : 'week-cell is-empty'}
                    >
                      {hits.length ? (
                        hits.map(({ course, session }) => (
                          <button
                            type="button"
                            key={`${course.id}-${session.day}-${session.section}`}
                            className="week-slot week-slot-btn"
                            onClick={() => openEdit(course, session.day, session.section)}
                          >
                            <b>{course.name}</b>
                            <span>{session.room}</span>
                          </button>
                        ))
                      ) : (
                        <button
                          type="button"
                          className="week-slot-empty"
                          onClick={() => openCreate(day, sectionIndex)}
                          aria-label={`${dayLabel} ${section}，排课`}
                        >
                          排课
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {draft
        ? createPortal(
            <div className="courses-modal-backdrop" onMouseDown={close}>
              <form
                className="courses-composer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="course-slot-dialog-title"
                onSubmit={save}
                onMouseDown={(event) => event.stopPropagation()}
              >
            <div>
              <h2 id="course-slot-dialog-title">{editing ? '改这一节' : '排进这一格'}</h2>
              <p>{slotLabel(draft.day, draft.section)} · 第 {weekNumber} 周</p>
            </div>

            <label>
              课程
              <input
                required
                autoFocus
                list="course-name-options"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="课名，或点下面已有课程"
              />
            </label>
            <datalist id="course-name-options">
              {courses.map((course) => (
                <option value={course.name} key={course.id} />
              ))}
            </datalist>
            {!editing && courses.length > 0 ? (
              <div className="course-pick-row">
                {courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    className={`course-pick-chip${draft.name === course.name ? ' is-on' : ''}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        name: course.name,
                        topic: currentCourseTopic(course, weekNumber),
                      })
                    }
                  >
                    {course.name}
                  </button>
                ))}
              </div>
            ) : null}

            <label>
              教室
              <input
                value={draft.room}
                onChange={(event) => setDraft({ ...draft, room: event.target.value })}
                placeholder="文科楼 205"
              />
            </label>

            <label>
              本周教什么
              <input
                value={draft.topic}
                onChange={(event) => setDraft({ ...draft, topic: event.target.value })}
                placeholder="选填，会出现在概览"
              />
            </label>

            <div className={`composer-actions${editing ? ' composer-actions-split' : ''}`}>
              {editing ? (
                <button type="button" className="danger-action" onClick={() => void dropSlot()}>
                  去掉这一格
                </button>
              ) : null}
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
        </div>,
            document.body,
          )
        : null}

      <TimetableImportDialog
        open={importing}
        courses={courses}
        weekNumber={weekNumber}
        onClose={() => setImporting(false)}
        onApply={onChange}
      />
    </section>
  )
}
