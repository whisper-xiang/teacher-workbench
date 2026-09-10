import type { CSSProperties } from 'react'
import type { CalendarEvent, CalendarKind, ReminderItem } from '../../data/types'
import { formatDayLabel, iso, times, weekdayLabel } from '../../lib/dates'
import { formatReminderTime, reminderClock, reminderTimeSlot } from '../../lib/reminder-nlp'
import { CALENDAR_KIND_LABELS, isAllDayCalendarKind } from './calendar-model'

export type CalendarDayEntry =
  | { key: string; type: 'event'; item: CalendarEvent; done: boolean; sort: number }
  | { key: string; type: 'reminder'; item: ReminderItem; done: boolean; sort: number }

type Props = {
  view: 'week' | 'month'
  days: Date[]
  monthDays: Date[]
  cursorMonth: number
  today: string
  selectedDay: string
  activeEventId: string | null
  events: CalendarEvent[]
  selectedDayEntries: CalendarDayEntry[]
  remindersOn: (date: string) => ReminderItem[]
  onSelectDay: (date: string) => void
  onSelectMonthDay: (day: Date) => void
  onOpenEvent: (event: CalendarEvent) => void
  onOpenReminder: (reminder: ReminderItem) => void
  onToggleEventDone: (event: CalendarEvent) => void
  onNewEvent: () => void
  onNewReminder: () => void
}

function KindBadge({ kind }: { kind: CalendarKind | 'reminder' }) {
  return (
    <span className={`kind-badge kind-badge-${kind}`}>
      {kind === 'reminder' ? '提醒' : CALENDAR_KIND_LABELS[kind]}
    </span>
  )
}

function itemSubline(item: CalendarEvent) {
  if (isAllDayCalendarKind(item.kind)) return item.detail || CALENDAR_KIND_LABELS[item.kind]
  const place = item.detail.trim()
  return place ? `${times[item.start]} ${place}` : times[item.start]
}

function itemActionLabel(item: CalendarEvent) {
  if (item.kind === 'course') return '查看课程'
  if (item.kind === 'deadline') return '前往处理'
  if (item.kind === 'journal') return '打开随手记'
  return '编辑安排'
}

function layoutLanes(items: { id: string; start: number; length: number }[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.length - a.length)
  const laneEnds: number[] = []
  const laneOf = new Map<string, number>()
  for (const item of sorted) {
    let lane = laneEnds.findIndex((end) => end <= item.start)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(item.start + item.length)
    } else {
      laneEnds[lane] = item.start + item.length
    }
    laneOf.set(item.id, lane)
  }
  return { laneOf, cols: Math.max(1, laneEnds.length) }
}

function DayPanel({
  selectedDay,
  entries,
  onOpenEvent,
  onOpenReminder,
  onToggleEventDone,
  onNewEvent,
  onNewReminder,
}: Pick<Props, 'selectedDay' | 'onOpenEvent' | 'onOpenReminder' | 'onToggleEventDone' | 'onNewEvent' | 'onNewReminder'> & {
  entries: CalendarDayEntry[]
}) {
  return (
    <section className="side-card day-detail-card">
      <div className="side-card-title">
        <div>
          <h2>
            {formatDayLabel(new Date(`${selectedDay}T12:00:00`))} ·{' '}
            {weekdayLabel(new Date(`${selectedDay}T12:00:00`))}
          </h2>
        </div>
      </div>
      <div className="day-detail-list">
        {entries.length === 0 && (
          <div className="empty-column">
            这一天暂无安排
            <button type="button" className="text-action" onClick={onNewEvent}>新建日程</button>
            <button type="button" className="text-action" onClick={onNewReminder}>添加提醒</button>
          </div>
        )}
        {entries.map((entry) =>
          entry.type === 'event' ? (
            <div key={entry.key} className={`day-detail-item${entry.item.done ? ' is-done' : ' is-open'}`}>
              <button
                type="button"
                className="day-detail-main"
                onClick={() => onOpenEvent(entry.item)}
                title={`${itemActionLabel(entry.item)}：${entry.item.title}`}
                aria-label={`${entry.item.title}，${itemSubline(entry.item)}，${itemActionLabel(entry.item)}`}
              >
                <span className={`day-detail-dot event-${entry.item.kind}`} />
                <span className="day-detail-body">
                  <b>{entry.item.title}</b>
                  <small>{itemSubline(entry.item)}</small>
                </span>
                <KindBadge kind={entry.item.kind} />
              </button>
              <label className="day-detail-check">
                <input
                  type="checkbox"
                  checked={Boolean(entry.item.done)}
                  onChange={() => onToggleEventDone(entry.item)}
                  aria-label={entry.item.done ? `取消完成 ${entry.item.title}` : `完成 ${entry.item.title}`}
                />
              </label>
            </div>
          ) : (
            <div key={entry.key} className={`day-detail-item${entry.item.status === 'pending' ? ' is-open' : ' is-done'}`}>
              <button
                type="button"
                className="day-detail-main"
                onClick={() => onOpenReminder(entry.item)}
                title={`编辑提醒：${entry.item.title}`}
                aria-label={`${entry.item.title}，${formatReminderTime(entry.item.scheduledAt)}，编辑提醒`}
              >
                <span className="day-detail-dot event-reminder" />
                <span className="day-detail-body">
                  <b>{entry.item.title}</b>
                  <small>
                    {formatReminderTime(entry.item.scheduledAt)}
                    {entry.item.status === 'fired' ? ' · 已提醒' : ''}
                    {entry.item.note ? ` · ${entry.item.note}` : ''}
                  </small>
                </span>
                <KindBadge kind="reminder" />
              </button>
            </div>
          ),
        )}
      </div>
    </section>
  )
}

export function CalendarWorkspace({
  view,
  days,
  monthDays,
  cursorMonth,
  today,
  selectedDay,
  activeEventId,
  events,
  selectedDayEntries,
  remindersOn,
  onSelectDay,
  onSelectMonthDay,
  onOpenEvent,
  onOpenReminder,
  onToggleEventDone,
  onNewEvent,
  onNewReminder,
}: Props) {
  const dayPanel = (
    <DayPanel
      selectedDay={selectedDay}
      entries={selectedDayEntries}
      onOpenEvent={onOpenEvent}
      onOpenReminder={onOpenReminder}
      onToggleEventDone={onToggleEventDone}
      onNewEvent={onNewEvent}
      onNewReminder={onNewReminder}
    />
  )

  if (view === 'month') {
    return (
      <div className="month-workspace">
        <section className="month-calendar">
          <div className="month-head">
            {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>周{day}</span>)}
          </div>
          <div className="month-grid">
            {monthDays.map((day) => {
              const dateStr = iso(day)
              const marks = [
                ...events.filter((item) => item.date === dateStr).map((item) => ({ id: item.id, title: item.title, kind: item.kind, done: Boolean(item.done) })),
                ...remindersOn(dateStr).map((item) => ({ id: item.id, title: item.title, kind: 'reminder' as const, done: item.status !== 'pending' })),
              ]
              return (
                <button
                  type="button"
                  className={`${day.getMonth() === cursorMonth ? '' : 'other-month'} ${dateStr === selectedDay ? 'is-selected' : ''} ${dateStr === today ? 'is-today' : ''}`}
                  key={dateStr}
                  onClick={() => onSelectMonthDay(day)}
                  aria-label={`${formatDayLabel(day)}，${marks.length ? `${marks.length} 项安排` : '暂无安排'}`}
                >
                  <strong>{day.getDate()}</strong>
                  {marks.slice(0, 3).map((item) => (
                    <span className={`month-event event-${item.kind}${item.done ? ' is-done' : ''}`} key={item.id}>{item.title}</span>
                  ))}
                  {marks.length > 3 && <small>还有 {marks.length - 3} 项</small>}
                </button>
              )
            })}
          </div>
        </section>
        <aside className="calendar-side month-side">{dayPanel}</aside>
      </div>
    )
  }

  return (
    <div className="calendar-workspace">
      <section className="week-calendar functional-week">
        <div className="week-allday" aria-label="全天">
          <span className="allday-label">全天</span>
          {days.map((day) => {
            const dateStr = iso(day)
            const allDayEvents = events.filter((item) => item.date === dateStr && isAllDayCalendarKind(item.kind))
            const allDayReminders = remindersOn(dateStr).filter((item) => reminderTimeSlot(item.scheduledAt, times) == null)
            const hot = allDayEvents.some((item) => item.id === activeEventId) || allDayReminders.some((item) => item.id === activeEventId)
            return (
              <div className={`allday-cell${dateStr === today ? ' today-column' : ''}${dateStr === selectedDay ? ' is-selected' : ''}${hot ? ' is-hot' : ''}`} key={dateStr}>
                {allDayEvents.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`allday-chip event-${item.kind}${item.done ? ' is-done' : ''}${item.id === activeEventId ? ' is-active' : ''}`}
                    onClick={() => onOpenEvent(item)}
                    title={`${itemActionLabel(item)}：${item.title}`}
                  >{item.title}</button>
                ))}
                {allDayReminders.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`allday-chip event-reminder${item.status !== 'pending' ? ' is-done' : ''}${item.id === activeEventId ? ' is-active' : ''}`}
                    onClick={() => onOpenReminder(item)}
                    title={`提醒 ${reminderClock(item.scheduledAt)}：${item.title}`}
                  >{reminderClock(item.scheduledAt)} {item.title}</button>
                ))}
              </div>
            )
          })}
        </div>
        <div className="week-head">
          <span>时间</span>
          {days.map((day) => {
            const dateStr = iso(day)
            return (
              <button type="button" key={dateStr} className={`week-day-btn${dateStr === today ? ' today-column' : ''}${dateStr === selectedDay ? ' is-selected' : ''}`} onClick={() => onSelectDay(dateStr)}>
                <span>{weekdayLabel(day)}</span><strong>{day.getDate()}</strong>
              </button>
            )
          })}
        </div>
        <div className="week-body">
          <div className="time-axis">{times.map((time) => <span key={time}>{time}</span>)}</div>
          <div className="week-grid">
            {days.map((day) => {
              const dateStr = iso(day)
              const timedEvents = events.filter((item) => item.date === dateStr && !isAllDayCalendarKind(item.kind))
              const timedReminders = remindersOn(dateStr)
                .map((item) => {
                  const start = reminderTimeSlot(item.scheduledAt, times)
                  return start == null ? null : { item, start, length: 1 }
                })
                .filter((entry): entry is { item: ReminderItem; start: number; length: number } => entry !== null)
              const { laneOf, cols } = layoutLanes([
                ...timedEvents.map((item) => ({ id: item.id, start: item.start, length: item.length })),
                ...timedReminders.map((entry) => ({ id: entry.item.id, start: entry.start, length: entry.length })),
              ])
              return (
                <div className={`day-column${dateStr === today ? ' today-column' : ''}${dateStr === selectedDay ? ' is-selected' : ''}`} key={dateStr} onClick={() => onSelectDay(dateStr)}>
                  {times.map((_, row) => {
                    const hot = Boolean(activeEventId) && (
                      timedEvents.some((item) => item.id === activeEventId && row >= item.start && row < item.start + Math.max(1, item.length)) ||
                      timedReminders.some((entry) => entry.item.id === activeEventId && row >= entry.start && row < entry.start + 1)
                    )
                    return <span className={`grid-cell${hot ? ' is-hot' : ''}`} key={row} />
                  })}
                  {timedEvents.map((item) => (
                    <button
                      type="button"
                      className={`calendar-event event-${item.kind}${item.done ? ' is-done' : ''}${item.id === activeEventId ? ' is-active' : ''}`}
                      style={{ '--event-start': item.start, '--event-length': item.length, '--event-lane': laneOf.get(item.id) ?? 0, '--event-cols': cols } as CSSProperties}
                      key={item.id}
                      title={`${item.title} · ${itemSubline(item)} · ${itemActionLabel(item)}`}
                      onClick={(event) => { event.stopPropagation(); onOpenEvent(item) }}
                    ><b>{item.title}</b><span>{item.detail}</span></button>
                  ))}
                  {timedReminders.map((entry) => (
                    <button
                      type="button"
                      className={`calendar-event event-reminder${entry.item.status !== 'pending' ? ' is-done' : ''}${entry.item.id === activeEventId ? ' is-active' : ''}`}
                      style={{ '--event-start': entry.start, '--event-length': entry.length, '--event-lane': laneOf.get(entry.item.id) ?? 0, '--event-cols': cols } as CSSProperties}
                      key={entry.item.id}
                      title={`提醒 ${reminderClock(entry.item.scheduledAt)}：${entry.item.title}`}
                      onClick={(event) => { event.stopPropagation(); onOpenReminder(entry.item) }}
                    ><b>{entry.item.title}</b><span>{reminderClock(entry.item.scheduledAt)}</span></button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </section>
      <aside className="calendar-side">{dayPanel}</aside>
    </div>
  )
}
