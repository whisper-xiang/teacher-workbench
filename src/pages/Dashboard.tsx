import { useMemo } from 'react'
import { MajorTag } from '../components/MajorTag'
import type { BoardTask, CalendarEvent, Course, WorkbenchMeta } from '../data/types'
import { times } from '../lib/dates'

type Props = {
  meta: WorkbenchMeta
  events: CalendarEvent[]
  tasks: BoardTask[]
  courses: Course[]
  onNavigate: (id: string) => void
  onSetTaskStatus: (id: string, done: boolean) => void
}

export function Dashboard({ meta, events, tasks, courses, onNavigate, onSetTaskStatus }: Props) {
  const focusDate = meta.weekStart
  // Use Tuesday of demo week as "today" for stable UX with seed, or real today if user advanced.
  const today = events.some((e) => e.date === new Date().toISOString().slice(0, 10))
    ? new Date().toISOString().slice(0, 10)
    : '2025-05-13'

  const schedule = useMemo(
    () =>
      events
        .filter((item) => item.date === today)
        .sort((a, b) => a.start - b.start)
        .map((item) => ({
          time: times[item.start],
          end: times[Math.min(times.length - 1, item.start + item.length)] ?? '',
          title: item.title,
          meta: item.detail,
          type: item.kind === 'course' ? '课程' : item.kind === 'duty' ? '值班' : item.kind === 'patrol' ? '巡视' : '会议',
        })),
    [events, today],
  )

  const focusTasks = useMemo(() => {
    const priority = { high: 0, medium: 1, low: 2 }
    return [...tasks]
      .sort(
        (a, b) =>
          (priority[a.priority ?? 'medium'] - priority[b.priority ?? 'medium']) ||
          (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
          a.title.localeCompare(b.title),
      )
      .slice(0, 5)
  }, [tasks])
  const pendingCount = focusTasks.filter((task) => task.status !== 'done').length
  const duties = events.filter((item) => item.date === today && (item.kind === 'duty' || item.kind === 'patrol'))
  const next = schedule[0]

  return (
    <section className="dashboard" aria-label="工作概览">
      {next && (
        <section className="next-event" aria-label="下一件事">
          <div>
            <p className="section-label">下一件事</p>
            <h2>
              {next.time} {next.title}
            </h2>
            <p>{next.meta}</p>
          </div>
          <button className="primary-action" onClick={() => onNavigate('calendar')}>
            查看今日日程
          </button>
        </section>
      )}

      <div className="dashboard-grid">
        <section className="dashboard-panel schedule-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">今日安排</p>
              <h2>按时间完成今天的工作</h2>
            </div>
            <button className="text-action" onClick={() => onNavigate('calendar')}>
              全部日程
            </button>
          </div>
          <div className="timeline">
            {schedule.length === 0 && <div className="empty-column">今天暂无日程，可在日历中添加。</div>}
            {schedule.map((item) => (
              <div className="timeline-item" key={`${item.time}-${item.title}`}>
                <div className="timeline-time">
                  <strong>{item.time}</strong>
                  <span>{item.end}</span>
                </div>
                <div className="timeline-content">
                  <span className={item.type === '课程' ? 'event-kind event-course' : 'event-kind'}>{item.type}</span>
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-panel task-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">需要处理</p>
              <h2>{pendingCount ? `${pendingCount} 项待完成` : '今日事项已完成'}</h2>
            </div>
            <button className="text-action" onClick={() => onNavigate('tasks')}>
              进入看板
            </button>
          </div>
          <ul className="task-list todo-list">
            {focusTasks.map((task) => {
              const done = task.status === 'done'
              return (
                <li className={done ? 'task-row task-done' : 'task-row'} key={task.id}>
                  <label className="task-check">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(event) => onSetTaskStatus(task.id, event.target.checked)}
                      aria-label={done ? `取消完成 ${task.title}` : `完成 ${task.title}`}
                    />
                    <span />
                  </label>
                  <button type="button" className="task-link" onClick={() => onNavigate('tasks')}>
                    <strong>{task.title}</strong>
                    <small>
                      {task.course} · {task.due}
                    </small>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <div className="dashboard-bottom">
        <section className="duty-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">今日值班安排</p>
              <h2>{duties.length ? `${duties.length} 项现场事务` : '今日无值班'}</h2>
            </div>
            <button className="text-action" onClick={() => onNavigate('calendar')}>
              查看周表
            </button>
          </div>
          <div className="duty-list">
            {duties.length === 0 && <div className="empty-column">今日无值班安排</div>}
            {duties.map((duty) => (
              <div className="duty-row" key={duty.id}>
                <strong>
                  {times[duty.start]}-{times[Math.min(times.length - 1, duty.start + duty.length)]}
                </strong>
                <span>
                  <b>{duty.title}</b>
                  <small>{duty.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="progress-overview" aria-labelledby="progress-overview-title">
        <div className="panel-heading">
          <div>
            <p className="section-label">教学进度总览</p>
            <h2 id="progress-overview-title">本学期课程推进情况</h2>
          </div>
          <button className="text-action" onClick={() => onNavigate('courses')}>
            进入课程管理 →
          </button>
        </div>
        <div className="dash-course-grid">
          {courses.map((course) => {
            const totalWeeks = course.totalWeeks || 16
            const currentWeek = course.currentWeek || Math.round((course.progress / 100) * totalWeeks) || meta.weekNumber
            const pct = Math.min(100, Math.round(course.progress || (currentWeek / totalWeeks) * 100))
            const room = course.sessions[0]?.room ?? '待排教室'
            return (
              <button
                type="button"
                className="dash-course-card"
                key={course.id}
                onClick={() => onNavigate('courses')}
              >
                <div className="dash-course-card-header">
                  <strong className="dash-course-name">{course.name}</strong>
                  <span className="dash-course-code">{course.code}</span>
                </div>
                <div className="dash-course-major">
                  <MajorTag major={course.major} />
                  <em className={`course-status course-${course.status}`}>{course.status}</em>
                </div>
                <div className="dash-course-meta">
                  <span>{course.students} 人</span>
                  <span>{room}</span>
                  <span>{course.credits ?? 2} 学分</span>
                </div>
                {course.topic && <p className="dash-course-topic">本周：{course.topic}</p>}
                <div className="dash-course-progress">
                  <div className="dash-course-progress-head">
                    <span>教学进度</span>
                    <b>
                      {currentWeek}/{totalWeeks} 周（{pct}%）
                    </b>
                  </div>
                  <div className="dash-progress-bar" aria-hidden="true">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>
      <p className="sr-only">{focusDate}</p>
    </section>
  )
}
