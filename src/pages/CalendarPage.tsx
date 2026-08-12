import { useMemo, useState } from 'react'
import { uid } from '../data/store'
import type { CalendarEvent, CalendarKind } from '../data/types'
import { formatDayLabel, iso, mondayOf, shift, times, weekdayLabel } from '../lib/dates'
import { notify } from '../lib/notify'

const labels: Record<CalendarKind, string> = {
  course: '课程',
  duty: '值班',
  meeting: '会议',
  patrol: '巡视',
  deadline: '截止',
}

function KindBadge({ kind }: { kind: CalendarKind }) {
  return <span className={`kind-badge kind-badge-${kind}`}>{labels[kind]}</span>
}

type Props = {
  events: CalendarEvent[]
  dutyConfirmedDates: string[]
  weekStart: string
  onChangeEvents: (events: CalendarEvent[]) => void
  onToggleDuty: (date: string) => void
}

export function CalendarPage({ events, dutyConfirmedDates, weekStart, onChangeEvents, onToggleDuty }: Props) {
  const seedCursor = new Date(weekStart + 'T12:00:00')
  const [view, setView] = useState<'week' | 'month'>('month')
  const [cursor, setCursor] = useState(seedCursor)
  const [selectedDay, setSelectedDay] = useState(iso(seedCursor))
  const [editor, setEditor] = useState<CalendarEvent | null>(null)

  const days = useMemo(() => Array.from({ length: 5 }, (_, index) => shift(mondayOf(cursor), index)), [cursor])
  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    return Array.from({ length: 42 }, (_, index) => shift(mondayOf(first), index))
  }, [cursor])

  const todayStr = iso(new Date())
  const focusDate = days.some((d) => iso(d) === todayStr)
    ? todayStr
    : iso(days.find((d) => iso(d) === selectedDay) ?? days[1] ?? cursor)

  const selectedDayEvents = useMemo(
    () =>
      events
        .filter((item) => item.date === selectedDay)
        .sort((a, b) => {
          if (a.kind === 'deadline' && b.kind !== 'deadline') return -1
          if (b.kind === 'deadline' && a.kind !== 'deadline') return 1
          return a.start - b.start
        }),
    [events, selectedDay],
  )

  const dutyEvent = selectedDayEvents.find((item) => item.kind === 'duty' || item.kind === 'patrol')
  const dutyConfirmed = dutyConfirmedDates.includes(selectedDay)

  const changePeriod = (amount: number) =>
    setCursor((current) => {
      const next = view === 'week' ? shift(current, amount * 7) : new Date(current.getFullYear(), current.getMonth() + amount, 1)
      if (view === 'week') setSelectedDay(iso(shift(mondayOf(next), 1)))
      return next
    })

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!editor?.title.trim()) return
    const next: CalendarEvent = {
      ...editor,
      id: editor.id || uid('event'),
      title: editor.title.trim(),
      detail: editor.detail.trim() || (editor.kind === 'deadline' ? '截止日期提醒' : '个人安排'),
      length: editor.kind === 'deadline' ? 1 : Math.max(1, editor.length || 1),
      start: editor.kind === 'deadline' ? 0 : editor.start,
      major: editor.major ?? null,
    }
    onChangeEvents(editor.id ? events.map((item) => (item.id === editor.id ? next : item)) : [...events, next])
    setSelectedDay(next.date)
    notify.success(`已保存到本地：${next.title}`)
    setEditor(null)
  }

  const remove = () => {
    if (!editor?.id) return
    onChangeEvents(events.filter((item) => item.id !== editor.id))
    notify.warning(`已删除：${editor.title}`, '已删除')
    setEditor(null)
  }

  const newEvent = (date = selectedDay || iso(cursor), kind: CalendarKind = 'meeting') =>
    setEditor({
      id: '',
      date,
      start: kind === 'deadline' ? 0 : 6,
      length: 1,
      title: '',
      detail: '',
      kind,
      major: null,
    })

  const goWeekOf = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    setCursor(date)
    setSelectedDay(dateStr)
    setView('week')
  }

  const toggleDuty = () => {
    onToggleDuty(selectedDay)
    if (dutyConfirmed) notify.info('已取消值班确认')
    else notify.success('已确认到岗（已写入本地）')
  }

  const dayPanel = (
    <section className="side-card day-detail-card">
      <div className="side-card-title">
        <div>
          <p className="section-label">当日安排</p>
          <h2>
            {formatDayLabel(new Date(selectedDay + 'T12:00:00'))} ·{' '}
            {weekdayLabel(new Date(selectedDay + 'T12:00:00'))}
          </h2>
        </div>
        <button type="button" className="text-action" onClick={() => newEvent(selectedDay)}>
          ＋ 添加
        </button>
      </div>

      {dutyEvent && (
        <div className="day-duty-strip">
          <div>
            <strong>
              {times[dutyEvent.start]}-
              {times[Math.min(times.length - 1, dutyEvent.start + dutyEvent.length)]} {dutyEvent.title}
            </strong>
            <small>{dutyEvent.detail}</small>
          </div>
          <button
            type="button"
            className={dutyConfirmed ? 'confirmed-action' : 'outline-action duty-confirm'}
            onClick={toggleDuty}
          >
            {dutyConfirmed ? '已确认到岗' : '确认到岗'}
          </button>
        </div>
      )}

      <div className="day-detail-list">
        {selectedDayEvents.length === 0 && <div className="empty-column">这一天暂无安排</div>}
        {selectedDayEvents.map((item) => (
          <button key={item.id} type="button" className="day-detail-item" onClick={() => setEditor(item)}>
            <span className={`day-detail-dot event-${item.kind}`} />
            <span className="day-detail-body">
              <b>{item.title}</b>
              <small>
                {item.kind === 'deadline' ? '全天提醒' : `${times[item.start]} · ${item.detail}`}
              </small>
            </span>
            <KindBadge kind={item.kind} />
          </button>
        ))}
      </div>
    </section>
  )

  return (
    <section className="calendar-page functional-calendar" aria-label="日程与值班">
      <div className="page-actions">
        <button
          type="button"
          className="outline-action"
          onClick={() => {
            setCursor(seedCursor)
            setSelectedDay(iso(seedCursor))
          }}
        >
          回到本周
        </button>
        <button type="button" className="primary-action" onClick={() => newEvent()}>
          ＋ 新建日程
        </button>
      </div>

      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" onClick={() => changePeriod(-1)} aria-label="上一时段">
            ‹
          </button>
          <strong>
            {cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月
          </strong>
          <button type="button" onClick={() => changePeriod(1)} aria-label="下一时段">
            ›
          </button>
        </div>
        <div className="view-switch">
          <button type="button" className={view === 'week' ? 'selected' : ''} onClick={() => setView('week')}>
            周视图
          </button>
          <button
            type="button"
            className={view === 'month' ? 'selected' : ''}
            onClick={() => {
              setView('month')
              setSelectedDay(iso(cursor))
            }}
          >
            月视图
          </button>
        </div>
      </div>

      {view === 'week' ? (
        <div className="calendar-workspace">
          <section className="week-calendar functional-week">
            <div className="week-allday" aria-label="全天与截止事项">
              <span className="allday-label">全天</span>
              {days.map((day) => {
                const dateStr = iso(day)
                const deadlines = events.filter((item) => item.date === dateStr && item.kind === 'deadline')
                return (
                  <div className={`allday-cell ${dateStr === focusDate ? 'today-column' : ''}`} key={dateStr}>
                    {deadlines.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="allday-chip event-deadline"
                        onClick={() => setEditor(item)}
                        title="点击编辑"
                      >
                        {item.title}
                      </button>
                    ))}
                    {deadlines.length === 0 && <span className="allday-empty">—</span>}
                  </div>
                )
              })}
            </div>
            <div className="week-head">
              <span>时间</span>
              {days.map((day) => {
                const dateStr = iso(day)
                return (
                  <button
                    type="button"
                    key={dateStr}
                    className={`week-day-btn ${dateStr === focusDate ? 'today-column' : ''} ${dateStr === selectedDay ? 'is-selected' : ''}`}
                    onClick={() => setSelectedDay(dateStr)}
                  >
                    <span>{weekdayLabel(day)}</span>
                    <strong>{day.getDate()}</strong>
                  </button>
                )
              })}
            </div>
            <div className="week-body">
              <div className="time-axis">
                {times.map((time) => (
                  <span key={time}>{time}</span>
                ))}
              </div>
              <div className="week-grid">
                {days.map((day) => {
                  const dateStr = iso(day)
                  const timed = events.filter((item) => item.date === dateStr && item.kind !== 'deadline')
                  return (
                    <div
                      className={`day-column ${dateStr === focusDate ? 'today-column' : ''} ${dateStr === selectedDay ? 'is-selected' : ''}`}
                      key={dateStr}
                      onDoubleClick={() => newEvent(dateStr)}
                    >
                      {times.map((_, row) => (
                        <span className="grid-cell" key={row} />
                      ))}
                      {timed.map((item) => (
                        <button
                          type="button"
                          className={`calendar-event event-${item.kind}`}
                          style={{ '--event-start': item.start, '--event-length': item.length } as React.CSSProperties}
                          key={item.id}
                          onClick={() => setEditor(item)}
                          title="点击编辑"
                        >
                          <b>{item.title}</b>
                          <span>{item.detail}</span>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <aside className="calendar-side">{dayPanel}</aside>
        </div>
      ) : (
        <div className="month-workspace">
          <section className="month-calendar">
            <div className="month-head">
              {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
                <span key={day}>周{day}</span>
              ))}
            </div>
            <div className="month-grid">
              {monthDays.map((day) => {
                const dateStr = iso(day)
                const list = events.filter((item) => item.date === dateStr)
                const selected = dateStr === selectedDay
                return (
                  <button
                    type="button"
                    className={`${day.getMonth() === cursor.getMonth() ? '' : 'other-month'} ${selected ? 'is-selected' : ''} ${dateStr === todayStr ? 'is-today' : ''}`}
                    key={dateStr}
                    onClick={() => setSelectedDay(dateStr)}
                    onDoubleClick={() => goWeekOf(dateStr)}
                  >
                    <strong>{day.getDate()}</strong>
                    {list.slice(0, 3).map((item) => (
                      <span
                        className={`month-event event-${item.kind}`}
                        key={item.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedDay(dateStr)
                          setEditor(item)
                        }}
                      >
                        {item.title}
                      </span>
                    ))}
                    {list.length > 3 && <small>还有 {list.length - 3} 项</small>}
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="calendar-side month-side">
            {dayPanel}
            <div className="month-detail-actions">
              <button type="button" className="outline-action" onClick={() => goWeekOf(selectedDay)}>
                查看该周
              </button>
              <button type="button" className="outline-action" onClick={() => newEvent(selectedDay, 'deadline')}>
                ＋ 截止
              </button>
            </div>
          </aside>
        </div>
      )}

      {editor && (
        <div className="calendar-modal-backdrop" onMouseDown={() => setEditor(null)}>
          <form className="calendar-composer" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <div className="composer-heading">
              <div>
                <p className="section-label">{editor.id ? '编辑日程' : '新建日程'}</p>
                <h2>{editor.id ? '修改安排' : '添加安排'}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setEditor(null)}>
                ×
              </button>
            </div>
            <label>
              日程名称
              <input
                autoFocus
                value={editor.title}
                onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                required
              />
            </label>
            <label>
              地点或说明
              <input value={editor.detail} onChange={(event) => setEditor({ ...editor, detail: event.target.value })} />
            </label>
            <div className="composer-grid">
              <label>
                日期
                <input
                  type="date"
                  value={editor.date}
                  onChange={(event) => setEditor({ ...editor, date: event.target.value })}
                  required
                />
              </label>
              <label>
                类型
                <select
                  value={editor.kind}
                  onChange={(event) => {
                    const kind = event.target.value as CalendarKind
                    setEditor({
                      ...editor,
                      kind,
                      start: kind === 'deadline' ? 0 : editor.start || 6,
                      length: kind === 'deadline' ? 1 : editor.length || 1,
                    })
                  }}
                >
                  {Object.entries(labels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {editor.kind !== 'deadline' && (
              <div className="composer-grid">
                <label>
                  开始时间
                  <select
                    value={editor.start}
                    onChange={(event) => setEditor({ ...editor, start: Number(event.target.value) })}
                  >
                    {times.map((time, index) => (
                      <option value={index} key={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  持续时长
                  <select
                    value={editor.length}
                    onChange={(event) => setEditor({ ...editor, length: Number(event.target.value) })}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option value={n} key={n}>
                        {n} 小时
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {editor.kind === 'deadline' && (
              <p className="composer-hint">截止日期将显示在「全天」行，不占用课时格子。</p>
            )}
            <div className="composer-actions">
              {editor.id && (
                <button type="button" className="delete-action" onClick={remove}>
                  删除日程
                </button>
              )}
              <span />
              <button type="button" className="outline-action" onClick={() => setEditor(null)}>
                取消
              </button>
              <button type="submit" className="primary-action">
                保存到本地
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
