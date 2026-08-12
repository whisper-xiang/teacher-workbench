import { useState } from 'react'
import { MajorFilter, MajorTag } from '../components/MajorTag'
import { uid } from '../data/store'
import type { Course, MajorId } from '../data/types'
import { notify } from '../lib/notify'

const weekDays = ['周一', '周二', '周三', '周四', '周五']
const sections = ['1–2 节', '3–4 节', '5–6 节', '7–8 节']
const sectionTimes = ['08:00–09:40', '10:00–11:40', '14:00–15:40', '16:00–17:40']

type Draft = {
  id: string
  name: string
  code: string
  className: string
  major: MajorId
  students: string
  credits: string
  description: string
  topic: string
  currentWeek: string
  totalWeeks: string
  day: string
  section: string
  room: string
}

function toDraft(course?: Course): Draft {
  const session = course?.sessions[0]
  return {
    id: course?.id ?? '',
    name: course?.name ?? '',
    code: course?.code ?? '',
    className: course?.className ?? '',
    major: course?.major ?? 'edu',
    students: String(course?.students ?? 40),
    credits: String(course?.credits ?? 2),
    description: course?.description ?? '',
    topic: course?.topic ?? '',
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
  const [major, setMajor] = useState<MajorId | '' | 'general'>('')
  const [draft, setDraft] = useState<Draft | null>(null)

  const visible = courses.filter((course) => !major || major === 'general' || course.major === major)
  const editing = Boolean(draft?.id)

  const openCreate = () => setDraft(toDraft())
  const openEdit = (course: Course) => setDraft(toDraft(course))
  const close = () => setDraft(null)

  const bumpWeek = (course: Course) => {
    if (course.currentWeek >= course.totalWeeks) {
      notify.info('已到学期末周次')
      return
    }
    const currentWeek = course.currentWeek + 1
    const progress = Math.round((currentWeek / course.totalWeeks) * 100)
    onChange(
      courses.map((item) =>
        item.id === course.id
          ? { ...item, currentWeek, progress, status: progress >= 50 ? '正常' : item.status }
          : item,
      ),
    )
    notify.success(`「${course.name}」→ 第 ${currentWeek}/${course.totalWeeks} 周`)
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft?.name.trim()) return

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

    const next: Course = {
      id: draft.id || uid('course'),
      name: draft.name.trim(),
      code: draft.code.trim() || 'EDU000',
      className: draft.className.trim() || '待定班级',
      students: Math.max(0, Number(draft.students) || 0),
      credits: Math.max(0, Number(draft.credits) || 0),
      major: draft.major,
      description: draft.description.trim() || undefined,
      topic: draft.topic.trim() || '待补充教学主题',
      currentWeek,
      totalWeeks,
      progress,
      weeks: `第 1–${totalWeeks} 周`,
      status: progress >= 50 ? '正常' : '待更新',
      color: courses.find((c) => c.id === draft.id)?.color ?? 'teal',
      sessions,
    }

    onChange(draft.id ? courses.map((course) => (course.id === draft.id ? next : course)) : [...courses, next])
    notify.success(draft.id ? `已保存「${next.name}」` : `已创建「${next.name}」`)
    close()
  }

  const remove = () => {
    if (!draft?.id) return
    if (!window.confirm(`确定删除「${draft.name || '该课程'}」？`)) return
    onChange(courses.filter((course) => course.id !== draft.id))
    notify.warning(`已删除：${draft.name}`, '已删除')
    close()
  }

  return (
    <section className="courses-page courses-page-simple" aria-label="课程与排课">
      <div className="page-actions">
        <button className="primary-action" onClick={openCreate}>
          ＋ 新建课程
        </button>
      </div>

      <div className="courses-toolbar">
        <MajorFilter value={major} onChange={setMajor} />
        <p className="courses-toolbar-note">点卡片编辑 · 点「进度」推进一周 · 课表可点进课程</p>
      </div>

      <div className="course-card-grid">
        {visible.map((course) => {
          const pct = progressPct(course)
          const session = course.sessions[0]
          return (
            <article className="course-overview-card" key={course.id}>
              <button type="button" className="course-overview-main" onClick={() => openEdit(course)}>
                <div className="course-overview-head">
                  <h3>{course.name}</h3>
                  <span className="course-code">{course.code}</span>
                </div>
                <div className="course-overview-tags">
                  <MajorTag major={course.major} />
                  <span className="course-credit-pill">{course.credits} 学分</span>
                </div>
                <p className="course-overview-desc">{course.description || course.topic || '暂无简介'}</p>
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
              </button>
              <div className="course-card-actions">
                <button type="button" className="outline-action" onClick={() => openEdit(course)}>
                  编辑
                </button>
                <button type="button" className="primary-action" onClick={() => bumpWeek(course)}>
                  进度 +1 周
                </button>
              </div>
            </article>
          )
        })}
        {visible.length === 0 && <div className="course-empty">该专业下暂无课程</div>}
      </div>

      <section className="week-overview" aria-label="总周课表">
        <div className="week-overview-head">
          <h2>周课表</h2>
          <p>点击格子编辑对应课程</p>
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
                  const hit = visible.find((course) =>
                    course.sessions.some((item) => item.day === day && item.section === sectionIndex),
                  )
                  const session = hit?.sessions.find((item) => item.day === day && item.section === sectionIndex)
                  return (
                    <td key={`${section}-${day}`}>
                      {hit && session ? (
                        <button type="button" className={`week-slot week-slot-btn ${hit.major}`} onClick={() => openEdit(hit)}>
                          <b>{hit.name}</b>
                          <span>
                            {hit.className}
                            <br />
                            {session.room}
                          </span>
                        </button>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {draft && (
        <div className="courses-modal-backdrop" onMouseDown={close}>
          <form className="courses-composer courses-composer-wide" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <div>
              <p className="section-label">{editing ? '编辑课程' : '新建课程'}</p>
              <h2>{editing ? '保存后同步到周课表' : '一门课 · 一个时段'}</h2>
            </div>

            <label>
              课程名称
              <input required autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label>
              简介
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="课程目标一句话" />
            </label>

            <div className="composer-grid">
              <label>
                代码
                <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
              </label>
              <label>
                学分
                <input value={draft.credits} onChange={(e) => setDraft({ ...draft, credits: e.target.value })} />
              </label>
            </div>

            <div className="composer-grid">
              <label>
                班级
                <input value={draft.className} onChange={(e) => setDraft({ ...draft, className: e.target.value })} />
              </label>
              <label>
                人数
                <input value={draft.students} onChange={(e) => setDraft({ ...draft, students: e.target.value })} />
              </label>
            </div>

            <div className="composer-grid">
              <label>
                专业
                <select value={draft.major} onChange={(e) => setDraft({ ...draft, major: e.target.value as MajorId })}>
                  <option value="edu">教育学</option>
                  <option value="pri">小学教育</option>
                  <option value="pre">学前教育</option>
                </select>
              </label>
              <label>
                本周主题
                <input value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} />
              </label>
            </div>

            <div className="composer-grid">
              <label>
                当前周
                <input value={draft.currentWeek} onChange={(e) => setDraft({ ...draft, currentWeek: e.target.value })} />
              </label>
              <label>
                总周数
                <input value={draft.totalWeeks} onChange={(e) => setDraft({ ...draft, totalWeeks: e.target.value })} />
              </label>
            </div>

            <fieldset className="course-session-fields">
              <legend>上课时段</legend>
              <div className="composer-grid">
                <label>
                  星期
                  <select value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })}>
                    {weekDays.map((day, index) => (
                      <option value={index} key={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  节次
                  <select value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })}>
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
                <input value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })} placeholder="文科楼 205" />
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
