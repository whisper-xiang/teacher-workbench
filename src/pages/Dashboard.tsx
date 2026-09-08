import { useMemo } from 'react'
import { MajorTag } from '../components/MajorTag'
import type { BoardTask, CalendarEvent, Course, TeacherProfile, WorkbenchMeta } from '../data/types'
import { deadlineLinkLabel, inferDeadlineLink } from '../lib/deadlines'
import { currentCourseTopic } from '../lib/courses'
import { formatDayLabel, iso, shift, times, todayIso, weekdayLabel } from '../lib/dates'
import { festivalLabel, lunarDateLabel } from '../lib/festivals'
import { NavIcon } from '../nav-icons'

type Props = {
  meta: WorkbenchMeta
  profile: TeacherProfile
  events: CalendarEvent[]
  tasks: BoardTask[]
  courses: Course[]
  onNavigate: (id: string, param?: string) => void
  onSetTaskStatus: (id: string, done: boolean) => void
}

const KIND_LABEL: Record<CalendarEvent['kind'], string> = {
  course: '课程',
  duty: '值班',
  patrol: '巡视',
  deadline: '截止',
  meeting: '会议',
}

function periodWord(start: number) {
  if (start <= 2) return '上午'
  if (start <= 5) return '午间'
  if (start <= 8) return '午后'
  return '晚间'
}

function wavePath(values: number[], width: number, height: number) {
  const padX = 18
  const padY = 16
  const max = Math.max(1.5, ...values)
  const pts = values.map((value, index) => ({
    x: padX + (index * (width - padX * 2)) / Math.max(1, values.length - 1),
    y: height - padY - (value / max) * (height - padY * 2) * 0.82,
  }))
  if (pts.length === 0) return { line: '', area: '' }
  let line = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i === 0 ? i : i - 1]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  const area = `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`
  return { line, area }
}

export function Dashboard({ meta, profile, events, tasks, courses, onNavigate, onSetTaskStatus }: Props) {
  const now = new Date()
  const today = todayIso()
  const festival = festivalLabel(now)
  const lunarLabel = lunarDateLabel(now)
  const termWeekLabel = `${meta.termLabel} · 开学第 ${meta.weekNumber} 周`

  const schedule = useMemo(
    () =>
      events
        .filter((item) => item.date === today && !item.done)
        .sort((a, b) => a.start - b.start),
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
      .slice(0, 4)
  }, [tasks])

  const pendingCount = tasks.filter((task) => task.status !== 'done').length
  const courseToday = schedule.filter((item) => item.kind === 'course')
  const dutyToday = schedule.filter((item) => item.kind === 'duty' || item.kind === 'patrol')
  const next = schedule[0]

  const headline = useMemo(() => {
    if (festival.includes('教师节')) return '教师节快乐'
    if (dutyToday.some((item) => item.kind === 'patrol')) return '实习巡视日'
    if (courseToday.length >= 3) return '今日连堂满课'
    if (courseToday.length === 2) return `${periodWord(courseToday[0].start)}两门课`
    if (courseToday.length === 1) return `${periodWord(courseToday[0].start)}有课`
    if (dutyToday.length) return '今日值班在岗'
    if (pendingCount) return '今日适合备课'
    return '今日节奏从容'
  }, [festival, dutyToday, courseToday, pendingCount])

  const story = useMemo(() => {
    const bits = [`${formatDayLabel(now)} ${weekdayLabel(now)}，${termWeekLabel}。`]
    if (lunarLabel) bits[0] = `${bits[0].slice(0, -1)}，${lunarLabel}。`
    if (next) {
      const when = next.kind === 'deadline' ? '截止' : times[next.start]
      bits.push(`下一件是「${next.title}」，${when} 开始${next.detail ? `，${next.detail}` : ''}。`)
    } else {
      bits.push('今天日程较轻，可以把时间留给备课、批改或整理教学资源。')
    }
    if (festival && festival !== '今日无节日') bits.push(`今天是${festival}。`)
    return bits.join('')
  }, [now, termWeekLabel, lunarLabel, next, festival])

  const weekDays = useMemo(() => {
    const start = new Date(`${meta.weekStart}T12:00:00`)
    return Array.from({ length: 6 }, (_, index) => {
      const date = shift(start, index)
      const dateIso = iso(date)
      const count = events.filter((item) => item.date === dateIso && !item.done).length
      return {
        iso: dateIso,
        label: weekdayLabel(date).replace('周', ''),
        count,
        current: dateIso === today,
      }
    })
  }, [events, meta.weekStart, today])

  const pulse = useMemo(() => wavePath(weekDays.map((day) => day.count + 0.4), 640, 148), [weekDays])

  const featuredCourses = useMemo(() => {
    const todayNames = new Set(courseToday.map((item) => item.title))
    return [...courses]
      .sort((a, b) => Number(todayNames.has(b.name)) - Number(todayNames.has(a.name)) || a.name.localeCompare(b.name, 'zh'))
      .slice(0, 3)
  }, [courses, courseToday])

  const nextTime = next ? (next.kind === 'deadline' ? '截止' : times[next.start]) : `${meta.weekNumber}`
  const nextUnit = next ? '' : '周'
  const nextPlace = next?.detail || profile.college

  return (
    <section className="dashboard glass-dashboard" aria-label="工作概览">
      <div className="dash-stage">
        <div className="dash-hero">
          <span className="dash-pill">工作概览</span>
          <h2>{headline}</h2>
          <p className="dash-story">{story}</p>

          <div className="dash-hours" aria-label="今日安排">
            {(schedule.length ? schedule.slice(0, 6) : []).map((item) => {
              const link = item.kind === 'deadline' ? item.linkTo ?? inferDeadlineLink(item) : undefined
              return (
                <button
                  type="button"
                  className="dash-hour"
                  key={item.id}
                  onClick={() => (link ? onNavigate(link.route, link.param) : onNavigate('calendar'))}
                >
                  <b>{`${Number(times[item.start].slice(0, 2))}°`}</b>
                  <small>{KIND_LABEL[item.kind]}</small>
                  <span>{item.title}</span>
                </button>
              )
            })}
            {schedule.length === 0 && (
              <div className="dash-hour dash-hour-empty">
                <b>—°</b>
                <small>空档</small>
                <span>今天暂无日程</span>
              </div>
            )}
          </div>

          {focusTasks.length > 0 && (
            <ul className="dash-task-pills">
              {focusTasks.map((task) => {
                const done = task.status === 'done'
                return (
                  <li key={task.id}>
                    <label className={done ? 'is-done' : undefined}>
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(event) => onSetTaskStatus(task.id, event.target.checked)}
                      />
                      <span>{task.title}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="dash-week">
            <svg className="dash-wave" viewBox="0 0 640 148" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="dash-wave-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <filter id="dash-wave-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path d={pulse.area} fill="url(#dash-wave-fill)" />
              <path d={pulse.line} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" filter="url(#dash-wave-glow)" />
            </svg>
            <div className="dash-week-days">
              {weekDays.map((day) => (
                <button
                  type="button"
                  key={day.iso}
                  className={day.current ? 'is-current' : undefined}
                  onClick={() => onNavigate('calendar')}
                >
                  <b>周{day.label}</b>
                  <small>{day.count} 项</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="dash-widgets" aria-label="今日卡片">
          <article className="glass-card dash-now">
            <header>
              <span>
                <NavIcon name="pin" size={16} />
                {nextPlace}
              </span>
              {next && <small>{KIND_LABEL[next.kind]}</small>}
            </header>
            <div className="dash-now-temp">
              <strong>{nextTime}</strong>
              {nextUnit && <em>{nextUnit}</em>}
            </div>
            <p>{next ? next.title : '本学期推进中'}</p>
            <div className="dash-now-stats">
              <button type="button" onClick={() => onNavigate('tasks')}>
                <NavIcon name="wind" size={16} />
                <b>{pendingCount}</b>
                <span>待办</span>
              </button>
              <button type="button" onClick={() => onNavigate('calendar')}>
                <NavIcon name="drop" size={16} />
                <b>{courseToday.length}</b>
                <span>今日课</span>
              </button>
              <button type="button" onClick={() => onNavigate('calendar')}>
                <NavIcon name="eye" size={16} />
                <b>{dutyToday.length}</b>
                <span>值班</span>
              </button>
            </div>
            {next?.kind === 'deadline' && (() => {
              const link = next.linkTo ?? inferDeadlineLink(next)
              return link ? (
                <button type="button" className="dash-now-link" onClick={() => onNavigate(link.route, link.param)}>
                  {deadlineLinkLabel(link)}
                </button>
              ) : null
            })()}
          </article>

          {featuredCourses.map((course) => {
            const topic = currentCourseTopic(course)
            return (
              <button
                type="button"
                className="glass-card dash-place"
                key={course.id}
                onClick={() => onNavigate('courses')}
              >
                <div>
                  <strong>{course.name}</strong>
                  <span>{topic || course.status}</span>
                </div>
                <b>
                  {course.currentWeek}
                  <small>周</small>
                </b>
                <MajorTag major={course.major} compact />
              </button>
            )
          })}
        </aside>
      </div>
      <p className="sr-only">{today}</p>
    </section>
  )
}
