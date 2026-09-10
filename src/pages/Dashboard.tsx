import { useMemo } from 'react'
import '../dashboard.css'
import '../overview-overrides.css'
import type { BoardTask, CalendarEvent, Course, DeadlineLink, WorkbenchMeta } from '../data/types'
import { DISABLED_NAV } from '../lib/disabled-nav'
import { deadlineLinkLabel, inferDeadlineLink } from '../lib/deadlines'
import { currentCourseTopic, matchCourseFromEvent } from '../lib/courses'
import { formatDayLabel, termWeekOf, times, todayIso, weekdayLabel } from '../lib/dates'

type Props = {
  meta: WorkbenchMeta
  events: CalendarEvent[]
  tasks: BoardTask[]
  courses: Course[]
  onNavigate: (id: string, param?: string) => void
  onSetTaskStatus: (id: string, done: boolean) => void
  onSetEventDone: (id: string, done: boolean) => void
}

const KIND_LABEL: Record<CalendarEvent['kind'], string> = {
  course: '课程',
  duty: '值班',
  patrol: '巡视',
  deadline: '截止',
  meeting: '会议',
  journal: '随手记',
}

type TodayItem = {
  id: string
  source: 'event' | 'task'
  title: string
  typeLabel: string
  time: string
  start: number
  done: boolean
  detail?: string
  link?: DeadlineLink
  actionLabel?: string
}

function hourLabel(item: CalendarEvent) {
  return item.kind === 'deadline' ? '截止' : times[item.start]
}

function buildTodayWork(events: CalendarEvent[], tasks: BoardTask[], courses: Course[], today: string): TodayItem[] {
  const fromEvents: TodayItem[] = events
    .filter((item) => item.date === today && item.kind !== 'journal')
    .map((item) => {
      const course = matchCourseFromEvent(item, courses)
      const deadlineLink = item.kind === 'deadline' ? item.linkTo ?? inferDeadlineLink(item) : undefined
      const link = deadlineLink && !DISABLED_NAV.has(deadlineLink.route) ? deadlineLink : undefined
      const topic = course ? currentCourseTopic(course) : ''
      return {
        id: item.id,
        source: 'event' as const,
        title: item.title,
        typeLabel: KIND_LABEL[item.kind],
        time: hourLabel(item),
        start: item.kind === 'deadline' ? 0 : item.start,
        done: Boolean(item.done),
        detail: topic || item.detail || undefined,
        link,
        actionLabel: link ? deadlineLinkLabel(link) : undefined,
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
      typeLabel: task.kind || '待办',
      time: '待办',
      start: 80,
      done: task.status === 'done',
      detail: task.course || task.desc || undefined,
    }))
  return [...fromEvents, ...fromTasks].sort((a, b) => a.start - b.start || a.title.localeCompare(b.title, 'zh'))
}

export function Dashboard({
  meta,
  events,
  tasks,
  courses,
  onNavigate,
  onSetTaskStatus,
  onSetEventDone,
}: Props) {
  const now = new Date()
  const today = todayIso()
  const week = termWeekOf(now, meta.weekStart, meta.weekNumber)
  const kicker = `${formatDayLabel(now)} ${weekdayLabel(now)} · 开学第 ${week} 周`

  const todayWork = useMemo(() => buildTodayWork(events, tasks, courses, today), [events, tasks, courses, today])
  const pendingWork = todayWork.filter((item) => !item.done)
  const total = todayWork.length
  const doneCount = total - pendingWork.length
  const pct = total === 0 ? 100 : Math.round((doneCount / total) * 100)

  const toggleWork = (item: TodayItem, done: boolean) => {
    if (item.source === 'task') onSetTaskStatus(item.id, done)
    else onSetEventDone(item.id, done)
  }

  return (
    <section className="dashboard glass-dashboard" aria-label="工作概览">
      <div className="dash-stage">
        <div className="dash-hero">
          <p className="dash-kicker">{kicker}</p>
          {total === 0 ? (
            <>
              <h2>今天暂无事项</h2>
              <p className="dash-empty">
                还没有安排，
                <button type="button" className="dash-text-link" onClick={() => onNavigate('calendar')}>
                  去日历
                </button>
                {' 或 '}
                <button type="button" className="dash-text-link" onClick={() => onNavigate('tasks')}>
                  进入看板
                </button>
              </p>
            </>
          ) : (
            <>
              <h2>{pendingWork.length === 0 ? '今日事项已完成' : '今日事项'}</h2>
              <div className="dash-progress" aria-label={`今日工作已完成 ${doneCount} / ${total}`}>
                <span>
                  已完成 {doneCount} / {total}
                </span>
                <div className="dash-progress-bar">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
              <ul className="dash-today" aria-label="今日全部事项">
                {todayWork.map((item) => {
                  const link = item.link
                  const key = `${item.source}-${item.id}`
                  const className = item.done ? 'dash-item is-done' : 'dash-item'
                  return (
                    <li key={key} className={className}>
                      <b className={item.time === '截止' || item.time === '待办' ? 'is-word' : undefined}>{item.time}</b>
                      <div className="dash-item-body">
                        <small>{item.typeLabel}</small>
                        <strong>{item.title}</strong>
                        {item.detail && <span>{item.detail}</span>}
                      </div>
                      {link && (
                        <button
                          type="button"
                          className="dash-text-link"
                          onClick={() => onNavigate(link.route, link.param)}
                        >
                          {item.actionLabel}
                        </button>
                      )}
                      <label className="dash-item-check">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleWork(item, !item.done)}
                          aria-label={item.done ? `取消完成 ${item.title}` : `完成 ${item.title}`}
                        />
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
      <p className="sr-only">{today}</p>
    </section>
  )
}
