import { useMemo, useState } from 'react'
import { MajorFilter, MajorTag } from '../components/MajorTag'
import { uid } from '../data/store'
import type { CalendarEvent, CalendarKind, DutySlot, MajorId } from '../data/types'
import { formatDayLabel, iso, mondayOf, shift, times, weekdayLabel } from '../lib/dates'
import { notify } from '../lib/notify'

const labels: Record<CalendarKind, string> = {
  course: '课程',
  duty: '值班',
  meeting: '会议',
  patrol: '巡视',
  deadline: '截止',
}

const dayNames = ['', '周一', '周二', '周三', '周四', '周五']

function dutyTypeClass(type: string) {
  if (type.includes('值班')) return 'office'
  if (type.includes('上课')) return 'class'
  if (type.includes('巡查') || type.includes('巡视')) return type.includes('实习') ? 'visit' : 'patrol'
  return 'office'
}

function KindBadge({ kind }: { kind: CalendarKind }) {
  return <span className={`kind-badge kind-badge-${kind}`}>{labels[kind]}</span>
}

type Props = {
  events: CalendarEvent[]
  dutyRoster: DutySlot[]
  dutyConfirmedDates: string[]
  weekStart: string
  onChangeEvents: (events: CalendarEvent[]) => void
  onToggleDuty: (date: string) => void
}

export function CalendarPage({ events, dutyRoster, dutyConfirmedDates, weekStart, onChangeEvents, onToggleDuty }: Props) {
  const seedCursor = new Date(weekStart + 'T12:00:00')
  const [view, setView] = useState<'week' | 'month'>('week')
  const [cursor, setCursor] = useState(seedCursor)
  const [selectedDay, setSelectedDay] = useState(iso(seedCursor))
  const [filter, setFilter] = useState<CalendarKind | 'all'>('all')
  const [major, setMajor] = useState<MajorId | '' | 'general'>('')
  const [editor, setEditor] = useState<CalendarEvent | null>(null)

  const days = useMemo(() => Array.from({ length: 5 }, (_, index) => shift(mondayOf(cursor), index)), [cursor])
  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    return Array.from({ length: 42 }, (_, index) => shift(mondayOf(first), index))
  }, [cursor])

  const shown = useMemo(
    () =>
      events.filter((item) => {
        if (filter !== 'all' && item.kind !== filter) return false
        if (major === 'general' && item.major) return false
        if (major && major !== 'general' && item.major !== major) return false
        return true
      }),
    [events, filter, major],
  )

  const todayStr = iso(new Date())
  const focusDate = days.some((d) => iso(d) === todayStr) ? todayStr : iso(days.find((d) => iso(d) === selectedDay) ?? days[1] ?? cursor)
  const focusDayObj = new Date(focusDate + 'T12:00:00')
  const dutyEvent = events.find((item) => item.kind === 'duty' && item.date === focusDate)
  const dutyConfirmed = dutyConfirmedDates.includes(focusDate)

  const upcoming = useMemo(
    () =>
      [...shown]
        .filter((item) => item.date >= focusDate)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'deadline' ? -1 : a.start - b.start))
        .slice(0, 5),
    [shown, focusDate],
  )

  const selectedDayEvents = useMemo(
    () =>
      shown
        .filter((item) => item.date === selectedDay)
        .sort((a, b) => {
          if (a.kind === 'deadline' && b.kind !== 'deadline') return -1
          if (b.kind === 'deadline' && a.kind !== 'deadline') return 1
          return a.start - b.start
        }),
    [shown, selectedDay],
  )

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

  return (
    <section className="calendar-page functional-calendar" aria-label="日程与值班">
      <div className="page-actions">
          <button
            className="outline-action"
            onClick={() => {
              setCursor(seedCursor)
              setSelectedDay(iso(seedCursor))
            }}
          >
            回到本周
          </button>
          <button className="primary-action" onClick={() => newEvent()}>
            ＋ 新建日程
          </button>
      </div>

      <div className="calendar-legend" aria-label="图例">
        <span>
          <i style={{ background: '#3f6b56' }} />
          课程
        </span>
        <span>
          <i style={{ background: '#6b5b95' }} />
          会议
        </span>
        <span>
          <i style={{ background: '#a67c52' }} />
          值班/巡视
        </span>
        <span>
          <i style={{ background: '#b54a3c' }} />
          截止日期
        </span>
      </div>

      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button onClick={() => changePeriod(-1)} aria-label="上一时段">
            ‹
          </button>
          <strong>
            {cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月
          </strong>
          <button onClick={() => changePeriod(1)} aria-label="下一时段">
            ›
          </button>
        </div>
        <div className="calendar-toolbar-right">
          <div className="view-switch">
            <button className={view === 'week' ? 'selected' : ''} onClick={() => setView('week')}>
              周视图
            </button>
            <button
              className={view === 'month' ? 'selected' : ''}
              onClick={() => {
                setView('month')
                setSelectedDay(iso(cursor))
              }}
            >
              月视图
            </button>
          </div>
          <MajorFilter value={major} onChange={setMajor} includeGeneral />
          <select
            className="calendar-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as CalendarKind | 'all')}
          >
            <option value="all">全部类型</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === 'week' ? (
        <div className="calendar-workspace">
          <section className="week-calendar functional-week">
            <div className="week-allday" aria-label="全天与截止事项">
              <span className="allday-label">全天</span>
              {days.map((day) => {
                const dateStr = iso(day)
                const deadlines = shown.filter((item) => item.date === dateStr && item.kind === 'deadline')
                return (
                  <div className={`allday-cell ${dateStr === focusDate ? 'today-column' : ''}`} key={dateStr}>
                    {deadlines.map((item) => (
                      <button key={item.id} className="allday-chip event-deadline" onClick={() => setEditor(item)} title="点击编辑">
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
                  const timed = shown.filter((item) => item.date === dateStr && item.kind !== 'deadline')
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

          <aside className="calendar-side">
            <section className="side-card">
              <div className="side-card-title">
                <div>
                  <p className="section-label">今日值班</p>
                  <h2>
                    {weekdayLabel(focusDayObj)} · {formatDayLabel(focusDayObj)}
                  </h2>
                </div>
                <b className="side-symbol">值</b>
              </div>
              <div className="duty-detail">
                <div className="duty-time">
                  <i>时</i>
                  <span>
                    <strong>
                      {dutyEvent
                        ? `${times[dutyEvent.start]} - ${times[Math.min(times.length - 1, dutyEvent.start + dutyEvent.length)]}`
                        : '暂无值班'}
                    </strong>
                    <small>{dutyEvent?.title ?? '可新建类型为「值班」的日程'}</small>
                  </span>
                </div>
                <div className="duty-place">
                  <i>地</i>
                  <span>{dutyEvent?.detail ?? '—'}</span>
                </div>
              </div>
              <button
                className={dutyConfirmed ? 'confirmed-action' : 'outline-action duty-confirm'}
                onClick={() => {
                  onToggleDuty(focusDate)
                  if (dutyConfirmed) notify.info('已取消值班确认')
                  else notify.success('已确认到岗（已写入本地）')
                }}
                disabled={!dutyEvent}
              >
                {dutyConfirmed ? '已确认到岗' : '确认到岗'}
              </button>
            </section>

            <section className="side-card day-detail-card">
              <div className="side-card-title">
                <div>
                  <p className="section-label">当日详情</p>
                  <h2>{formatDayLabel(new Date(selectedDay + 'T12:00:00'))}</h2>
                </div>
                <button className="text-action" onClick={() => newEvent(selectedDay)}>
                  ＋ 添加
                </button>
              </div>
              <div className="day-detail-list">
                {selectedDayEvents.length === 0 && <div className="empty-column">这一天暂无安排</div>}
                {selectedDayEvents.map((item) => (
                  <button key={item.id} className="day-detail-item" onClick={() => setEditor(item)}>
                    <span className={`day-detail-dot event-${item.kind}`} />
                    <span className="day-detail-body">
                      <b>{item.title}</b>
                      <small>
                        {item.kind === 'deadline' ? '全天提醒' : times[item.start]} · {item.detail}
                      </small>
                    </span>
                    <KindBadge kind={item.kind} />
                    <MajorTag major={item.major} compact />
                  </button>
                ))}
              </div>
            </section>

            <section className="side-card upcoming-card">
              <div className="side-card-title">
                <div>
                  <p className="section-label">接下来</p>
                  <h2>近期安排</h2>
                </div>
              </div>
              <div className="upcoming-list">
                {upcoming.map((item) => {
                  const date = new Date(item.date + 'T12:00:00')
                  return (
                    <button key={item.id} onClick={() => setEditor(item)}>
                      <span className="date-chip">
                        {date.getDate()}
                        <br />
                        <small>{weekdayLabel(date).replace('周', '')}</small>
                      </span>
                      <span>
                        <b>
                          {item.title} <KindBadge kind={item.kind} />
                        </b>
                        <small>
                          {item.kind === 'deadline' ? '全天' : times[item.start]} · {item.detail}
                          {item.major ? ' · ' : ''}
                          {item.major ? <MajorTag major={item.major} compact /> : null}
                        </small>
                      </span>
                    </button>
                  )
                })}
                {upcoming.length === 0 && <div className="empty-column">暂无后续安排</div>}
              </div>
            </section>
          </aside>
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
                const list = shown.filter((item) => item.date === dateStr)
                const selected = dateStr === selectedDay
                return (
                  <button
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

          <aside className="month-day-detail" aria-label="选中日期详情">
            <div className="side-card-title">
              <div>
                <p className="section-label">选中日期</p>
                <h2>
                  {formatDayLabel(new Date(selectedDay + 'T12:00:00'))} ·{' '}
                  {weekdayLabel(new Date(selectedDay + 'T12:00:00'))}
                </h2>
              </div>
            </div>
            <div className="month-detail-actions">
              <button className="outline-action" onClick={() => goWeekOf(selectedDay)}>
                查看该周
              </button>
              <button className="outline-action" onClick={() => newEvent(selectedDay, 'deadline')}>
                ＋ 截止
              </button>
              <button className="primary-action" onClick={() => newEvent(selectedDay)}>
                ＋ 新建
              </button>
            </div>
            <div className="day-detail-list">
              {selectedDayEvents.length === 0 && (
                <div className="empty-column">
                  暂无安排
                  <br />
                  <small>可新建日程，或双击日期进入周视图</small>
                </div>
              )}
              {selectedDayEvents.map((item) => (
                <button key={item.id} className="day-detail-item" onClick={() => setEditor(item)}>
                  <span className={`day-detail-dot event-${item.kind}`} />
                  <span className="day-detail-body">
                    <b>{item.title}</b>
                    <small>
                      {item.kind === 'deadline' ? '全天提醒' : `${times[item.start]} · ${item.detail}`}
                    </small>
                  </span>
                  <KindBadge kind={item.kind} />
                  <MajorTag major={item.major} compact />
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      <section className="duty-roster" aria-label="本周值班排班表">
        <div className="duty-roster-head">
          <div>
            <p className="section-label">值班安排</p>
            <h2>本周事务总表</h2>
          </div>
          <span>{dutyRoster.length} 项</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="duty-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>时段</th>
                <th>时间</th>
                <th>类型</th>
                <th>地点</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {dutyRoster.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{dayNames[item.day]}</strong>
                  </td>
                  <td>{item.period}</td>
                  <td>{item.time}</td>
                  <td>
                    <span className={`duty-type ${dutyTypeClass(item.type)}`}>{item.type}</span>
                  </td>
                  <td>{item.location}</td>
                  <td style={{ color: 'var(--muted)' }}>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
            <label>
              关联专业
              <select
                value={editor.major ?? ''}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    major: (event.target.value || null) as MajorId | null,
                  })
                }
              >
                <option value="">通用 / 不限</option>
                <option value="edu">教育学</option>
                <option value="pri">小学教育</option>
                <option value="pre">学前教育</option>
              </select>
            </label>
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
