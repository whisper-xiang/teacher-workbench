import { useMemo } from 'react'
import { MajorTag } from '../components/MajorTag'
import type { BoardTask, CalendarEvent, Course, TeacherProfile, WorkbenchMeta } from '../data/types'
import { deadlineLinkLabel, inferDeadlineLink } from '../lib/deadlines'
import { formatDayLabel, times, todayIso, weekdayLabel } from '../lib/dates'
import { currentCourseTopic } from '../lib/courses'
import { festivalLabel, lunarDateLabel } from '../lib/festivals'
import { useHealthPet } from '../hooks/useHealthPet'
import { HEALTH_ITEMS, healthProgress } from '../lib/health-pet'

type Props = {
  meta: WorkbenchMeta
  profile: TeacherProfile
  events: CalendarEvent[]
  tasks: BoardTask[]
  courses: Course[]
  onNavigate: (id: string, param?: string) => void
  onSetTaskStatus: (id: string, done: boolean) => void
}

export function Dashboard({ meta, profile, events, tasks, courses, onNavigate, onSetTaskStatus }: Props) {
  const now = new Date()
  const today = todayIso()
  const { state: health, punch, undo, setGoals } = useHealthPet()

  const schedule = useMemo(
    () =>
      events
        .filter((item) => item.date === today && !item.done)
        .sort((a, b) => a.start - b.start)
        .map((item) => ({
          time: item.kind === 'deadline' || item.kind === 'journal' ? (item.kind === 'journal' ? '随手记' : '截止') : times[item.start],
          end: item.kind === 'deadline' || item.kind === 'journal' ? '' : times[Math.min(times.length - 1, item.start + item.length)] ?? '',
          title: item.title,
          meta: item.detail,
          type:
            item.kind === 'course'
              ? '课程'
              : item.kind === 'duty'
                ? '值班'
                : item.kind === 'patrol'
                  ? '巡视'
                  : item.kind === 'deadline'
                    ? '截止'
                    : item.kind === 'journal'
                      ? '随手记'
                      : '会议',
          event: item,
        })),
    [events, today],
  )

  const todayFocus = useMemo(() => {
    const eventItems = events
      .filter((item) => item.date === today && !item.done && item.kind !== 'journal')
      .sort((a, b) => a.start - b.start)
      .map((item) => item.title)
    const priority = { high: 0, medium: 1, low: 2 }
    const taskItems = [...tasks]
      .filter((task) => task.status !== 'done')
      .sort(
        (a, b) =>
          (priority[a.priority ?? 'medium'] - priority[b.priority ?? 'medium']) ||
          (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
          a.title.localeCompare(b.title),
      )
      .filter((task) => task.dueDate === today || task.priority === 'high' || eventItems.length < 3)
      .map((task) => task.title)
    const seen = new Set<string>()
    return [...eventItems, ...taskItems].filter((title) => {
      if (seen.has(title)) return false
      seen.add(title)
      return true
    }).slice(0, 5)
  }, [events, tasks, today])

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
  const todayLabel = `${formatDayLabel(now)} · ${weekdayLabel(now)}`
  const lunarLabel = lunarDateLabel(now)
  const termWeekLabel = `${meta.termLabel} · 开学第 ${meta.weekNumber} 周`
  const greeting = profile.greetingName || `${profile.name}老师`

  return (
    <section className="dashboard" aria-label="工作概览">
      <section className="companion-banner" aria-label="今日陪伴">
        <div className="companion-speech">
          <p className="section-label">工作概览</p>
          <h2>
            {greeting}，{todayLabel}
          </h2>
          {lunarLabel && <p className="overview-banner-lunar">{lunarLabel}</p>}
          {todayFocus.length > 0 ? (
            <>
              <p className="companion-lead">今天主要需要完成：</p>
              <ol className="companion-tasks">
                {todayFocus.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className="companion-lead">今天日程比较轻松，记得照顾一下自己。</p>
          )}
          <div className="companion-tags">
            <span>{festivalLabel(now)}</span>
            <span>{termWeekLabel}</span>
          </div>
        </div>
        <div className="companion-care" aria-label="健康打卡">
          <p className="section-label">每日健康打卡</p>
          <p className="companion-lead">点一次记一回，小宁会跟着高兴。目标可按自己的节奏改。</p>
          <div className="care-punch-grid">
            {HEALTH_ITEMS.map((item) => {
              const progress = healthProgress(health, item.id)
              return (
                <article key={item.id} className={progress.done ? 'care-card is-done' : 'care-card'}>
                  <div className="care-card-head">
                    <strong>{item.label}</strong>
                    <span>
                      {progress.count}/{progress.goal}
                      {item.unit}
                    </span>
                  </div>
                  <div className="care-bar" aria-hidden="true">
                    <i style={{ width: `${progress.pct}%` }} />
                  </div>
                  <small>{item.hint}</small>
                  <div className="care-card-actions">
                    <button type="button" className="care-punch" onClick={() => punch(item.id)} disabled={progress.done}>
                      {progress.done ? '今日已完成' : '打卡 +1'}
                    </button>
                    <button type="button" className="goal-step" onClick={() => undo(item.id)} disabled={progress.count === 0}>
                      撤销
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          <div className="care-goals">
            {HEALTH_ITEMS.map((item) => (
              <label key={item.id}>
                每日{item.label}
                <span>
                  <button
                    type="button"
                    className="goal-step"
                    onClick={() => setGoals({ [item.id]: health.goals[item.id] - 1 })}
                    aria-label={`${item.label}目标减一`}
                  >
                    −
                  </button>
                  <b>
                    {health.goals[item.id]}
                    {item.unit}
                  </b>
                  <button
                    type="button"
                    className="goal-step"
                    onClick={() => setGoals({ [item.id]: health.goals[item.id] + 1 })}
                    aria-label={`${item.label}目标加一`}
                  >
                    ＋
                  </button>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-panel schedule-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">今日安排 · {formatDayLabel(now)}</p>
              <h2>按时间完成今天的工作</h2>
            </div>
            <button className="text-action" onClick={() => onNavigate('calendar')}>
              全部日程
            </button>
          </div>
          <div className="timeline">
            {schedule.length === 0 && <div className="empty-column">今天暂无日程，可在日历中添加。</div>}
            {schedule.map((item, index) => {
              const link =
                item.event.kind === 'deadline' || item.event.kind === 'journal'
                  ? item.event.linkTo ?? inferDeadlineLink(item.event)
                  : undefined
              return (
              <div className={index === 0 ? 'timeline-item timeline-item-next' : 'timeline-item'} key={`${item.time}-${item.title}`}>
                <div className="timeline-time">
                  <strong>{item.time}</strong>
                  <span>{item.end}</span>
                </div>
                <div className="timeline-content">
                  {index === 0 && <span className="timeline-next-badge">下一件事</span>}
                  <span className={item.type === '课程' ? 'event-kind event-course' : 'event-kind'}>{item.type}</span>
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                  {link && (
                    <button type="button" className="text-action" onClick={() => onNavigate(link.route, link.param)}>
                      {deadlineLinkLabel(link)}
                    </button>
                  )}
                </div>
              </div>
              )
            })}
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
            进入教学 →
          </button>
        </div>
        <div className="dash-course-grid">
          {courses.map((course) => {
            const totalWeeks = course.totalWeeks || 16
            const currentWeek = course.currentWeek || Math.round((course.progress / 100) * totalWeeks) || meta.weekNumber
            const pct = Math.min(100, Math.round(course.progress || (currentWeek / totalWeeks) * 100))
            const topic = currentCourseTopic(course)
            const sessionLabel =
              course.sessions.length > 1
                ? `${course.sessions.length} 个时段`
                : course.sessions[0]?.room ?? '待排教室'
            return (
              <button
                type="button"
                className="dash-course-card"
                key={course.id}
                onClick={() => onNavigate('courses', course.id)}
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
                  <span>{sessionLabel}</span>
                  <span>{course.credits ?? 2} 学分</span>
                </div>
                {topic && <p className="dash-course-topic">本周：{topic}</p>}
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
      <p className="sr-only">{today}</p>
    </section>
  )
}
