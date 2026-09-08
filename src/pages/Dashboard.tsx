import { useMemo } from 'react'
import { MajorTag } from '../components/MajorTag'
import type { BoardTask, CalendarEvent, Course, DeadlineLink, TeacherProfile, WorkbenchMeta } from '../data/types'
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
  onSetEventDone: (id: string, done: boolean) => void
}

const EVENT_TYPE: Record<string, string> = {
  course: '课程',
  duty: '值班',
  patrol: '巡视',
  deadline: '截止',
  meeting: '会议',
}

type TodayItem = {
  id: string
  source: 'event' | 'task'
  title: string
  detail: string
  typeLabel: string
  time: string
  end: string
  start: number
  done: boolean
  link?: DeadlineLink
}

function eventTimeLabel(item: CalendarEvent) {
  if (item.kind === 'deadline') return { time: '截止', end: '', start: 0 }
  return {
    time: times[item.start] ?? '',
    end: times[Math.min(times.length - 1, item.start + item.length)] ?? '',
    start: item.start,
  }
}

function buildTodayWork(events: CalendarEvent[], tasks: BoardTask[], today: string): TodayItem[] {
  const fromEvents: TodayItem[] = events
    .filter((item) => item.date === today && item.kind !== 'journal')
    .map((item) => {
      const stamp = eventTimeLabel(item)
      const link =
        item.kind === 'deadline' ? item.linkTo ?? inferDeadlineLink(item) : undefined
      return {
        id: item.id,
        source: 'event' as const,
        title: item.title,
        detail: item.detail,
        typeLabel: EVENT_TYPE[item.kind] ?? '安排',
        ...stamp,
        done: Boolean(item.done),
        link,
      }
    })
  const titles = new Set(fromEvents.map((item) => item.title.trim()))
  const fromTasks: TodayItem[] = tasks
    .filter((task) => task.dueDate === today)
    .filter((task) => !titles.has(task.title.trim()))
    .map((task) => ({
      id: task.id,
      source: 'task' as const,
      title: task.title,
      detail: [task.course, task.due].filter(Boolean).join(' · '),
      typeLabel: task.kind || '待办',
      time: '待办',
      end: '',
      start: 80,
      done: task.status === 'done',
    }))
  return [...fromEvents, ...fromTasks].sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))
}

export function Dashboard({
  meta,
  profile,
  events,
  tasks,
  courses,
  onNavigate,
  onSetTaskStatus,
  onSetEventDone,
}: Props) {
  const now = new Date()
  const today = todayIso()
  const { state: health, punch, undo, setGoals } = useHealthPet()
  const todayWork = useMemo(() => buildTodayWork(events, tasks, today), [events, tasks, today])
  const pending = todayWork.filter((item) => !item.done)
  const finished = todayWork.filter((item) => item.done)
  const total = todayWork.length
  const doneCount = finished.length
  const pct = total === 0 ? 100 : Math.round((doneCount / total) * 100)
  const todayLabel = `${formatDayLabel(now)} · ${weekdayLabel(now)}`
  const lunarLabel = lunarDateLabel(now)
  const termWeekLabel = `${meta.termLabel} · 开学第 ${meta.weekNumber} 周`
  const greeting = profile.greetingName || `${profile.name}老师`

  const toggle = (item: TodayItem, done: boolean) => {
    if (item.source === 'task') onSetTaskStatus(item.id, done)
    else onSetEventDone(item.id, done)
  }

  return (
    <section className="dashboard" aria-label="工作概览">
      <section className="companion-banner" aria-label="今日陪伴">
        <div className="companion-speech">
          <p className="section-label">工作概览</p>
          <h2>
            {greeting}，{todayLabel}
          </h2>
          {lunarLabel && <p className="overview-banner-lunar">{lunarLabel}</p>}
          <div className="today-progress" aria-label={`今日工作已完成 ${pct}%`}>
            <div className="today-progress-head">
              <p className="companion-lead">
                {total === 0
                  ? '今天没有待办日程，节奏可以松一些。'
                  : pct === 100
                    ? '今天的工作都完成了，真棒。'
                    : `今天的工作已完成 ${pct}%`}
              </p>
              <strong>
                {doneCount}/{total || 0}
              </strong>
            </div>
            <div className="today-progress-bar" aria-hidden="true">
              <i style={{ width: `${pct}%` }} />
            </div>
            {total > 0 && (
              <small>
                {pending.length ? `还剩 ${pending.length} 项` : '待办已清空'}
                {finished.length ? ` · 已完成 ${finished.length} 项` : ''}
              </small>
            )}
          </div>
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

      <section className="dashboard-panel today-work-panel">
        <div className="panel-heading">
          <div>
            <p className="section-label">今日工作 · {formatDayLabel(now)}</p>
            <h2>{pct === 100 && total > 0 ? '今天的事项都完成了' : '勾选完成后会进到下面'}</h2>
          </div>
          <button className="text-action" type="button" onClick={() => onNavigate('calendar')}>
            全部日程
          </button>
        </div>

        <div className="today-work-block">
          <p className="today-work-kicker">待完成 · {pending.length}</p>
          {pending.length === 0 ? (
            <div className="empty-column">{total === 0 ? '今天暂无日程，可在日历中添加。' : '待办已经清空，完成项在下面。'}</div>
          ) : (
            <ul className="today-work-list">
              {pending.map((item, index) => (
                <TodayWorkRow
                  key={`${item.source}-${item.id}`}
                  item={item}
                  next={index === 0}
                  onToggle={toggle}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="today-work-block">
          <p className="today-work-kicker">已完成 · {finished.length}</p>
          {finished.length === 0 ? (
            <div className="empty-column">完成一项，就会出现在这里。</div>
          ) : (
            <ul className="today-work-list">
              {finished.map((item) => (
                <TodayWorkRow
                  key={`${item.source}-${item.id}`}
                  item={item}
                  next={false}
                  onToggle={toggle}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="progress-overview" aria-labelledby="progress-overview-title">
        <div className="panel-heading">
          <div>
            <p className="section-label">教学进度总览</p>
            <h2 id="progress-overview-title">本学期课程推进情况</h2>
          </div>
          <button className="text-action" type="button" onClick={() => onNavigate('courses')}>
            进入教学 →
          </button>
        </div>
        <div className="dash-course-grid">
          {courses.map((course) => {
            const totalWeeks = course.totalWeeks || 16
            const currentWeek = course.currentWeek || Math.round((course.progress / 100) * totalWeeks) || meta.weekNumber
            const coursePct = Math.min(100, Math.round(course.progress || (currentWeek / totalWeeks) * 100))
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
                      {currentWeek}/{totalWeeks} 周（{coursePct}%）
                    </b>
                  </div>
                  <div className="dash-progress-bar" aria-hidden="true">
                    <i style={{ width: `${coursePct}%` }} />
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

function TodayWorkRow({
  item,
  next,
  onToggle,
  onNavigate,
}: {
  item: TodayItem
  next: boolean
  onToggle: (item: TodayItem, done: boolean) => void
  onNavigate: (id: string, param?: string) => void
}) {
  return (
    <li className={`today-work-row${item.done ? ' is-done' : ''}${next ? ' is-next' : ''}`}>
      <label className="task-check">
        <input
          type="checkbox"
          checked={item.done}
          onChange={(event) => onToggle(item, event.target.checked)}
          aria-label={item.done ? `取消完成 ${item.title}` : `完成 ${item.title}`}
        />
        <span />
      </label>
      <div className="today-work-time">
        <strong>{item.time}</strong>
        {item.end && item.end !== item.time ? <span>{item.end}</span> : null}
      </div>
      <div className="today-work-body">
        {next && <span className="timeline-next-badge">下一件事</span>}
        <span className={item.typeLabel === '课程' ? 'event-kind event-course' : 'event-kind'}>{item.typeLabel}</span>
        <strong>{item.title}</strong>
        {item.detail ? <small>{item.detail}</small> : null}
        {item.link && (
          <button type="button" className="text-action" onClick={() => onNavigate(item.link!.route, item.link!.param)}>
            {deadlineLinkLabel(item.link)}
          </button>
        )}
      </div>
    </li>
  )
}
