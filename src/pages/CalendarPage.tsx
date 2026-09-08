import { useMemo, useState } from 'react'
import { uid } from '../data/store'
import type { CalendarEvent, CalendarKind, DeadlineLink, RouteId } from '../data/types'
import { deadlineLinkLabel, inferDeadlineLink } from '../lib/deadlines'
import { formatDayLabel, iso, mondayOf, shift, times, weekdayLabel } from '../lib/dates'
import { notify } from '../lib/notify'

const labels: Record<CalendarKind, string> = {
  course: '课程',
  duty: '值班',
  meeting: '会议',
  patrol: '巡视',
  deadline: '截止',
  journal: '随手记',
}

const CREATABLE_KINDS: CalendarKind[] = ['meeting', 'duty', 'patrol', 'deadline', 'course']

function isAllDayKind(kind: CalendarKind) {
  return kind === 'deadline' || kind === 'journal'
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
  onNavigate?: (route: RouteId, param?: string) => void
}

export function CalendarPage({ events, dutyConfirmedDates, weekStart, onChangeEvents, onToggleDuty, onNavigate }: Props) {
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
          if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1
          if (isAllDayKind(a.kind) && !isAllDayKind(b.kind)) return -1
          if (isAllDayKind(b.kind) && !isAllDayKind(a.kind)) return 1
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
    const base: CalendarEvent = {
      ...editor,
      id: editor.id || uid('event'),
      title: editor.title.trim(),
      detail: editor.detail.trim() || (editor.kind === 'deadline' ? '截止日期提醒' : '个人安排'),
      length: editor.kind === 'deadline' ? 1 : Math.max(1, editor.length || 1),
      start: editor.kind === 'deadline' ? 0 : editor.start,
    }
    const next: CalendarEvent = {
      ...base,
      linkTo: editor.kind === 'deadline' ? editor.linkTo ?? inferDeadlineLink(base) : editor.linkTo,
      done: Boolean(editor.done),
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

  const toggleEventDone = (item: CalendarEvent) => {
    onChangeEvents(events.map((event) => (event.id === item.id ? { ...event, done: !event.done } : event)))
    notify.success(item.done ? `已恢复「${item.title}」` : `已完成「${item.title}」`)
  }

  const openItem = (item: CalendarEvent) => {
    if (item.kind === 'journal') {
      openDeadlineLink({ ...item, linkTo: item.linkTo ?? { route: 'journal' } })
      return
    }
    setEditor(item)
  }

  const openDeadlineLink = (item: CalendarEvent) => {
    const link = item.linkTo ?? inferDeadlineLink(item)
    if (!link || !onNavigate) return
    onNavigate(link.route, link.param)
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
        <button type="button" className="primary-action" onClick={() => newEvent(selectedDay)}>
          ＋ 添加日程
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
          <div key={item.id} className={`day-detail-item${item.done ? ' is-done' : ' is-open'}`}>
            <button type="button" className="day-detail-main" onClick={() => openItem(item)}>
              <span className={`day-detail-dot event-${item.kind}`} />
              <span className="day-detail-body">
                <b>{item.title}</b>
                <small>
                  {isAllDayKind(item.kind) ? item.detail || '全天' : `${times[item.start]} · ${item.detail}`}
                </small>
              </span>
              <KindBadge kind={item.kind} />
            </button>
            <span className="deadline-actions">
              {item.kind === 'deadline' && (item.linkTo || inferDeadlineLink(item)) && onNavigate && (
                <button type="button" className="text-action" onClick={() => openDeadlineLink(item)}>
                  {deadlineLinkLabel(item.linkTo ?? inferDeadlineLink(item)!)}
                </button>
              )}
              {item.kind === 'journal' && onNavigate && (
                <button type="button" className="text-action" onClick={() => openItem(item)}>
                  查看随手记
                </button>
              )}
              <button type="button" className="text-action" onClick={() => toggleEventDone(item)}>
                {item.done ? '恢复未完成' : '标记完成'}
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )

  return (
    <section className="calendar-page functional-calendar" aria-label="日程与值班">
      <div className="page-actions calendar-page-actions">
        <p className="calendar-add-hint">课表会按周几铺满本学期；调课直接删除该节即可。随手记会在当天结束后出现在全天行。</p>
        <div className="calendar-page-actions-btns">
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
          <button type="button" className="primary-action calendar-add-btn" onClick={() => newEvent()}>
            ＋ 添加日程
          </button>
        </div>
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
            <div className="week-allday" aria-label="全天与随手记">
              <span className="allday-label">全天</span>
              {days.map((day) => {
                const dateStr = iso(day)
                const allDay = events.filter((item) => item.date === dateStr && isAllDayKind(item.kind))
                return (
                  <div className={`allday-cell ${dateStr === focusDate ? 'today-column' : ''}`} key={dateStr}>
                    {allDay.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`allday-chip event-${item.kind}${item.done ? ' is-done' : ''}`}
                        onClick={() => openItem(item)}
                        title={item.kind === 'journal' ? '查看随手记' : '点击编辑'}
                      >
                        {item.title}
                      </button>
                    ))}
                    {allDay.length === 0 && <span className="allday-empty">—</span>}
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
                  const timed = events.filter((item) => item.date === dateStr && !isAllDayKind(item.kind))
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
                          className={`calendar-event event-${item.kind}${item.done ? ' is-done' : ''}`}
                          style={{ '--event-start': item.start, '--event-length': item.length } as React.CSSProperties}
                          key={item.id}
                          onClick={() => openItem(item)}
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
                        className={`month-event event-${item.kind}${item.done ? ' is-done' : ''}`}
                        key={item.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedDay(dateStr)
                          openItem(item)
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
            {editor.id.startsWith('course-') && (
              <p className="composer-hint">这是课表自动生成的一节课。删除后本学期不再出现这一节，适合调课。</p>
            )}
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
                      start: isAllDayKind(kind) ? 0 : editor.start || 6,
                      length: isAllDayKind(kind) ? 1 : editor.length || 1,
                    })
                  }}
                  disabled={editor.kind === 'journal' || editor.id.startsWith('course-') || editor.id.startsWith('journal-')}
                >
                  {(editor.kind === 'journal' ? (Object.keys(labels) as CalendarKind[]) : CREATABLE_KINDS).map((value) => (
                    <option value={value} key={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {editor.kind !== 'deadline' && editor.kind !== 'journal' && (
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
              <>
                <p className="composer-hint">截止日期将显示在「全天」行，不占用课时格子。</p>
                <label>
                  处理入口
                  <select
                    value={editor.linkTo ? `${editor.linkTo.route}:${editor.linkTo.param ?? ''}` : ''}
                    onChange={(event) => {
                      const value = event.target.value
                      if (!value) {
                        setEditor({ ...editor, linkTo: undefined })
                        return
                      }
                      const [route, param] = value.split(':') as [RouteId, string]
                      const linkTo: DeadlineLink = param ? { route, param } : { route }
                      setEditor({ ...editor, linkTo })
                    }}
                  >
                    <option value="">不关联（保存时按标题推断）</option>
                    <option value="students:">学生与评价</option>
                    <option value="resources:">教学资源库</option>
                    <option value="journal:">随手记</option>
                    <option value="courses:">教学</option>
                    <option value="tasks:">教学看板</option>
                  </select>
                </label>
              </>
            )}
            {editor.kind === 'journal' && (
              <p className="composer-hint">随手记由当天结束后自动同步到日程，点「查看随手记」可回到原文。</p>
            )}
            {editor.id && editor.kind !== 'journal' && (
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={Boolean(editor.done)}
                  onChange={(event) => setEditor({ ...editor, done: event.target.checked })}
                />
                已完成此项
              </label>
            )}
            <div className="composer-actions">
              {editor.id && (
                <button type="button" className="delete-action" onClick={remove}>
                  {editor.id.startsWith('course-') ? '删除该节（调课）' : '删除日程'}
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
