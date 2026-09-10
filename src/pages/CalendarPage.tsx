import { useEffect, useMemo, useRef, useState } from 'react'
import { uid } from '../data/store'
import type {
  CalendarEvent,
  CalendarKind,
  Course,
  DeadlineLink,
  ReminderItem,
  ReminderSettings,
  RouteId,
} from '../data/types'
import { confirm } from '../lib/confirm'
import { DISABLED_NAV } from '../lib/disabled-nav'
import { inferDeadlineLink } from '../lib/deadlines'
import { formatDayLabel, iso, mondayOf, monthWeekLabel, shift, termWeekOf, times, weekdayLabel } from '../lib/dates'
import { notify } from '../lib/notify'
import {
  defaultReminderDatetime,
  formatReminderTime,
  fromDatetimeLocalInput,
  parseReminderNaturalLanguage,
  reminderClock,
  reminderDayIso,
  reminderTimeSlot,
  toDatetimeLocalInput,
  toLocalDateTimeIso,
  type ParsedReminder,
} from '../lib/reminder-nlp'
import {
  notificationPermission,
  notificationSupported,
  requestNotificationPermission,
} from '../lib/system-notify'

const labels: Record<CalendarKind, string> = {
  course: '课程',
  duty: '值班',
  meeting: '会议',
  patrol: '巡视',
  deadline: '截止',
  journal: '随手记',
}

const CREATABLE_KINDS: CalendarKind[] = ['meeting', 'duty', 'patrol', 'deadline']

type ReminderDraft = {
  id: string
  title: string
  scheduledAt: string
  note: string
  source: ReminderItem['source']
  rawInput: string
}

type DayMark = {
  id: string
  title: string
  kind: CalendarKind | 'reminder'
  done: boolean
}

function isAllDayKind(kind: CalendarKind) {
  return kind === 'deadline' || kind === 'journal'
}

function eventSortMinutes(item: CalendarEvent) {
  if (isAllDayKind(item.kind)) return -1
  const stamp = times[item.start] ?? '08:00'
  const [hour, minute] = stamp.split(':').map(Number)
  return hour * 60 + minute
}

function reminderSortMinutes(item: ReminderItem) {
  const date = new Date(item.scheduledAt)
  if (Number.isNaN(date.getTime())) return 0
  return date.getHours() * 60 + date.getMinutes()
}

function KindBadge({ kind }: { kind: CalendarKind | 'reminder' }) {
  return <span className={`kind-badge kind-badge-${kind}`}>{kind === 'reminder' ? '提醒' : labels[kind]}</span>
}

function itemSubline(item: CalendarEvent) {
  if (isAllDayKind(item.kind)) return item.detail || labels[item.kind]
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
    const start = item.start
    let lane = laneEnds.findIndex((end) => end <= start)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(start + item.length)
    } else {
      laneEnds[lane] = start + item.length
    }
    laneOf.set(item.id, lane)
  }
  return { laneOf, cols: Math.max(1, laneEnds.length) }
}

type Props = {
  events: CalendarEvent[]
  courses: Course[]
  reminders: ReminderItem[]
  settings: ReminderSettings
  weekStart: string
  weekNumber: number
  focusId?: string
  onChangeEvents: (events: CalendarEvent[]) => void
  onChangeReminders: (items: ReminderItem[]) => void
  onChangeSettings: (settings: ReminderSettings) => void
  onNavigate?: (route: RouteId, param?: string) => void
}

export function CalendarPage({
  events,
  reminders,
  settings,
  weekStart,
  weekNumber,
  focusId,
  onChangeEvents,
  onChangeReminders,
  onChangeSettings,
  onNavigate,
}: Props) {
  const today = new Date()
  const todayStr = iso(today)
  const [view, setView] = useState<'week' | 'month'>('month')
  const [cursor, setCursor] = useState(today)
  const [selectedDay, setSelectedDay] = useState(todayStr)
  const [editor, setEditor] = useState<CalendarEvent | null>(null)
  const [peek, setPeek] = useState<CalendarEvent | null>(null)
  const [reminderEditor, setReminderEditor] = useState<ReminderDraft | null>(null)
  const [aiInput, setAiInput] = useState('')
  const [aiPreview, setAiPreview] = useState<ParsedReminder | null>(null)
  const [weekLabelMode, setWeekLabelMode] = useState<'term' | 'month'>('term')
  const [activeEventId, setActiveEventId] = useState<string | null>(null)
  const editorRef = useRef<HTMLFormElement | null>(null)
  const peekRef = useRef<HTMLDivElement | null>(null)
  const reminderRef = useRef<HTMLFormElement | null>(null)
  const focusedReminderRef = useRef<string | null>(null)

  const days = useMemo(() => Array.from({ length: 5 }, (_, index) => shift(mondayOf(cursor), index)), [cursor])
  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    return Array.from({ length: 42 }, (_, index) => shift(mondayOf(first), index))
  }, [cursor])

  const visibleReminders = useMemo(
    () => reminders.filter((item) => item.status !== 'cancelled'),
    [reminders],
  )

  const remindersOn = (dateStr: string) =>
    visibleReminders.filter((item) => reminderDayIso(item.scheduledAt) === dateStr)

  const marksOn = (dateStr: string): DayMark[] => [
    ...events
      .filter((item) => item.date === dateStr)
      .map((item) => ({ id: item.id, title: item.title, kind: item.kind, done: Boolean(item.done) })),
    ...remindersOn(dateStr).map((item) => ({
      id: item.id,
      title: item.title,
      kind: 'reminder' as const,
      done: item.status !== 'pending',
    })),
  ]

  const selectedDayEvents = useMemo(
    () =>
      events
        .filter((item) => item.date === selectedDay)
        .sort((a, b) => {
          if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1
          const byTime = eventSortMinutes(a) - eventSortMinutes(b)
          if (byTime) return byTime
          return a.start - b.start
        }),
    [events, selectedDay],
  )

  const selectedDayReminders = useMemo(
    () =>
      visibleReminders
        .filter((item) => reminderDayIso(item.scheduledAt) === selectedDay)
        .sort((a, b) => {
          if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1
          return a.scheduledAt.localeCompare(b.scheduledAt)
        }),
    [visibleReminders, selectedDay],
  )

  const selectedDayEntries = useMemo(() => {
    const eventEntries = selectedDayEvents.map((item) => ({
      key: item.id,
      type: 'event' as const,
      item,
      done: Boolean(item.done),
      sort: eventSortMinutes(item),
    }))
    const reminderEntries = selectedDayReminders.map((item) => ({
      key: item.id,
      type: 'reminder' as const,
      item,
      done: item.status !== 'pending',
      sort: reminderSortMinutes(item),
    }))
    return [...eventEntries, ...reminderEntries].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return a.sort - b.sort
    })
  }, [selectedDayEvents, selectedDayReminders])

  const showingToday =
    selectedDay === todayStr &&
    (view === 'week'
      ? days.some((day) => iso(day) === todayStr)
      : cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth())

  const cursorWeek = termWeekOf(cursor, weekStart, weekNumber)
  const canToggleWeekLabel = view === 'week' && cursorWeek >= 1
  const periodLabel =
    view === 'week'
      ? cursorWeek < 1
        ? '开学前'
        : weekLabelMode === 'month'
          ? monthWeekLabel(cursor)
          : `第 ${cursorWeek} 周`
      : `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`
  const activeDialog = editor ? 'editor' : peek ? 'course' : reminderEditor ? 'reminder' : null
  const permission = notificationPermission()
  const canNotify = notificationSupported()

  useEffect(() => {
    if (!activeDialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const surface =
      activeDialog === 'editor' ? editorRef.current : activeDialog === 'reminder' ? reminderRef.current : peekRef.current
    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusables = () =>
      surface
        ? Array.from(surface.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hidden)
        : []

    if (activeDialog === 'course') window.requestAnimationFrame(() => focusables()[0]?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setEditor(null)
        setPeek(null)
        setReminderEditor(null)
        setAiPreview(null)
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [activeDialog])

  useEffect(() => {
    if (!focusId || focusedReminderRef.current === focusId) return
    if (focusId === 'remind') {
      focusedReminderRef.current = focusId
      setReminderEditor({
        id: '',
        title: '',
        scheduledAt: defaultReminderDatetime(todayStr),
        note: '',
        source: 'manual',
        rawInput: '',
      })
      setAiInput('')
      setAiPreview(null)
      return
    }
    const reminder = reminders.find((item) => item.id === focusId)
    if (!reminder) return
    focusedReminderRef.current = focusId
    const when = new Date(reminder.scheduledAt)
    const day = reminderDayIso(reminder.scheduledAt)
    setSelectedDay(day)
    setCursor(Number.isNaN(when.getTime()) ? new Date(`${day}T12:00:00`) : when)
    setActiveEventId(reminder.id)
    const weekday = Number.isNaN(when.getTime()) ? new Date(`${day}T12:00:00`).getDay() : when.getDay()
    if (weekday === 0 || weekday === 6) setView('month')
  }, [focusId, reminders, todayStr])

  const changePeriod = (amount: number) => {
    setActiveEventId(null)
    if (view === 'week') {
      setCursor((current) => shift(current, amount * 7))
      setSelectedDay((day) => iso(shift(new Date(`${day}T12:00:00`), amount * 7)))
      return
    }
    setCursor((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + amount, 1)
      setSelectedDay((day) => {
        const selected = new Date(`${day}T12:00:00`)
        if (selected.getFullYear() === next.getFullYear() && selected.getMonth() === next.getMonth()) return day
        if (today.getFullYear() === next.getFullYear() && today.getMonth() === next.getMonth()) return todayStr
        return iso(next)
      })
      return next
    })
  }

  const goToday = () => {
    const now = new Date()
    setCursor(now)
    setSelectedDay(iso(now))
    setActiveEventId(null)
  }

  const setViewAroundSelected = (next: 'week' | 'month') => {
    setCursor(new Date(`${selectedDay}T12:00:00`))
    setView(next)
  }

  const selectMonthDay = (day: Date) => {
    const dateStr = iso(day)
    if (day.getFullYear() !== cursor.getFullYear() || day.getMonth() !== cursor.getMonth()) {
      setCursor(new Date(day.getFullYear(), day.getMonth(), 1))
    }
    setSelectedDay(dateStr)
    setActiveEventId(null)
  }

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
    notify.success(`已保存：${next.title}`)
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

  const closeReminderEditor = () => {
    setReminderEditor(null)
    setAiInput('')
    setAiPreview(null)
  }

  const newReminder = (date = selectedDay || iso(cursor)) => {
    setEditor(null)
    setPeek(null)
    setAiInput('')
    setAiPreview(null)
    setReminderEditor({
      id: '',
      title: '',
      scheduledAt: defaultReminderDatetime(date),
      note: '',
      source: 'manual',
      rawInput: '',
    })
  }

  const openReminder = (item: ReminderItem) => {
    setSelectedDay(reminderDayIso(item.scheduledAt))
    setActiveEventId(item.id)
    setEditor(null)
    setPeek(null)
    setAiInput(item.rawInput ?? '')
    setAiPreview(null)
    setReminderEditor({
      id: item.id,
      title: item.title,
      scheduledAt: item.scheduledAt,
      note: item.note ?? '',
      source: item.source,
      rawInput: item.rawInput ?? '',
    })
  }

  const saveReminder = (event: React.FormEvent) => {
    event.preventDefault()
    if (!reminderEditor?.title.trim() || !reminderEditor.scheduledAt) return
    const scheduledAt = fromDatetimeLocalInput(toDatetimeLocalInput(reminderEditor.scheduledAt))
    const existing = reminders.find((item) => item.id === reminderEditor.id)
    const due = new Date(scheduledAt).getTime()
    const status: ReminderItem['status'] =
      Number.isNaN(due) || due > Date.now() ? 'pending' : (existing?.status ?? 'pending')
    const payload: ReminderItem = {
      id: reminderEditor.id || uid('rem'),
      title: reminderEditor.title.trim(),
      note: reminderEditor.note.trim() || undefined,
      scheduledAt,
      status,
      source: reminderEditor.source,
      rawInput: reminderEditor.rawInput.trim() || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      firedAt: status === 'pending' ? undefined : existing?.firedAt,
    }
    onChangeReminders(
      reminderEditor.id ? reminders.map((item) => (item.id === reminderEditor.id ? payload : item)) : [payload, ...reminders],
    )
    setSelectedDay(reminderDayIso(scheduledAt))
    setActiveEventId(payload.id)
    notify.success(reminderEditor.id ? `已保存提醒「${payload.title}」` : `已添加提醒「${payload.title}」`)
    closeReminderEditor()
  }

  const parseAiReminder = () => {
    const parsed = parseReminderNaturalLanguage(aiInput)
    if (!parsed) {
      notify.warning('未能识别时间，请包含如「明天下午3点」「30分钟后」等表达')
      setAiPreview(null)
      return
    }
    setAiPreview(parsed)
    setReminderEditor((current) =>
      current
        ? {
            ...current,
            title: parsed.title,
            scheduledAt: parsed.scheduledAt,
            source: 'ai',
            rawInput: aiInput.trim(),
          }
        : current,
    )
  }

  const snoozeReminder = (item: ReminderItem, minutes: number) => {
    const nextTime = toLocalDateTimeIso(new Date(new Date(item.scheduledAt).getTime() + minutes * 60_000))
    onChangeReminders(
      reminders.map((entry) =>
        entry.id === item.id ? { ...entry, scheduledAt: nextTime, status: 'pending', firedAt: undefined } : entry,
      ),
    )
    setReminderEditor((current) => (current?.id === item.id ? { ...current, scheduledAt: nextTime } : current))
    setSelectedDay(reminderDayIso(nextTime))
    notify.success(`已推迟 ${minutes} 分钟`)
  }

  const cancelReminder = (id: string) => {
    onChangeReminders(reminders.map((item) => (item.id === id ? { ...item, status: 'cancelled' } : item)))
    notify.info('已取消提醒')
    closeReminderEditor()
  }

  const removeReminder = async (id: string) => {
    const item = reminders.find((entry) => entry.id === id)
    if (!item) return
    try {
      await confirm.delete(`确定删除「${item.title}」？`)
    } catch {
      return
    }
    onChangeReminders(reminders.filter((entry) => entry.id !== id))
    notify.warning(`已删除：${item.title}`, '已删除')
    closeReminderEditor()
  }

  const enableSystemNotify = async () => {
    if (settings.systemNotifyEnabled && permission === 'granted') {
      onChangeSettings({ ...settings, systemNotifyEnabled: false })
      notify.info('已切换为仅应用内提醒')
      return
    }
    const result = await requestNotificationPermission()
    if (result === 'granted') {
      onChangeSettings({ ...settings, systemNotifyEnabled: true })
      notify.success('系统通知已开启')
      return
    }
    if (result === 'denied') notify.error('系统通知被拒绝，请在浏览器或系统设置中允许')
    else notify.info('当前环境不支持系统通知，将仅使用应用内提醒')
  }

  const toggleEventDone = (item: CalendarEvent) => {
    onChangeEvents(events.map((event) => (event.id === item.id ? { ...event, done: !event.done } : event)))
    notify.success(item.done ? `已恢复「${item.title}」` : `已完成「${item.title}」`)
  }

  const openDeadlineLink = (item: CalendarEvent) => {
    const link = item.linkTo ?? inferDeadlineLink(item)
    if (!link || DISABLED_NAV.has(link.route) || !onNavigate) return false
    onNavigate(link.route, link.param)
    return true
  }

  const dropCourse = async (item: CalendarEvent) => {
    try {
      await confirm({
        title: '本节省课',
        message: `删除后，本学期不再自动出现这一节「${item.title}」。`,
        confirmButtonText: '本节省课',
        confirmButtonClass: 'danger',
      })
    } catch {
      return
    }
    onChangeEvents(events.filter((event) => event.id !== item.id))
    notify.warning(`已调课：${item.title}`)
    setPeek(null)
  }

  const openItem = (item: CalendarEvent) => {
    setSelectedDay(item.date)
    setActiveEventId(item.id)
    if (item.kind === 'journal') {
      onNavigate?.('journal')
      return
    }
    if (item.kind === 'course') {
      setPeek(item)
      return
    }
    if (item.kind === 'deadline' && openDeadlineLink(item)) return
    setEditor(item)
  }

  const dayPanel = (
    <section className="side-card day-detail-card">
      <div className="side-card-title">
        <div>
          <h2>
            {formatDayLabel(new Date(`${selectedDay}T12:00:00`))} · {weekdayLabel(new Date(`${selectedDay}T12:00:00`))}
          </h2>
        </div>
      </div>

      <div className="day-detail-list">
        {selectedDayEntries.length === 0 && (
          <div className="empty-column">
            这一天暂无安排
            <button type="button" className="text-action" onClick={() => newEvent()}>
              新建日程
            </button>
            <button type="button" className="text-action" onClick={() => newReminder()}>
              添加提醒
            </button>
          </div>
        )}
        {selectedDayEntries.map((entry) =>
          entry.type === 'event' ? (
            <div key={entry.key} className={`day-detail-item${entry.item.done ? ' is-done' : ' is-open'}`}>
              <button
                type="button"
                className="day-detail-main"
                onClick={() => openItem(entry.item)}
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
                  onChange={() => toggleEventDone(entry.item)}
                  aria-label={entry.item.done ? `取消完成 ${entry.item.title}` : `完成 ${entry.item.title}`}
                />
              </label>
            </div>
          ) : (
            <div
              key={entry.key}
              className={`day-detail-item${entry.item.status === 'pending' ? ' is-open' : ' is-done'}`}
            >
              <button
                type="button"
                className="day-detail-main"
                onClick={() => openReminder(entry.item)}
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

  return (
    <section className="calendar-page functional-calendar" aria-label="日程与值班">
      <header className="calendar-heading">
        <div className="calendar-heading-copy">
          <h1>日程与值班</h1>
        </div>
        <div className="calendar-toolbar">
          <div className="calendar-nav">
            <button
              type="button"
              className="outline-action calendar-nav-btn"
              onClick={() => changePeriod(-1)}
              aria-label={view === 'week' ? '上一周' : '上一月'}
            >
              ‹
            </button>
            {canToggleWeekLabel ? (
              <button
                type="button"
                className="calendar-period-toggle"
                onClick={() => setWeekLabelMode((mode) => (mode === 'term' ? 'month' : 'term'))}
                aria-label={weekLabelMode === 'term' ? '切换为月内周次' : '切换为教学周次'}
                title={weekLabelMode === 'term' ? '切换为月内周次' : '切换为教学周次'}
              >
                {periodLabel}
              </button>
            ) : (
              <strong>{periodLabel}</strong>
            )}
            <button
              type="button"
              className="outline-action calendar-nav-btn"
              onClick={() => changePeriod(1)}
              aria-label={view === 'week' ? '下一周' : '下一月'}
            >
              ›
            </button>
          </div>
          <div className="view-switch">
            <button
              type="button"
              className={view === 'week' ? 'selected' : ''}
              aria-pressed={view === 'week'}
              onClick={() => setViewAroundSelected('week')}
            >
              周
            </button>
            <button
              type="button"
              className={view === 'month' ? 'selected' : ''}
              aria-pressed={view === 'month'}
              onClick={() => setViewAroundSelected('month')}
            >
              月
            </button>
          </div>
        </div>
        <div className="calendar-page-actions-btns">
          {!showingToday && (
            <button type="button" className="outline-action" onClick={goToday}>
              今天
            </button>
          )}
          <button type="button" className="primary-action" onClick={() => newEvent()}>
            添加
          </button>
          <button type="button" className="outline-action" onClick={() => newReminder()}>
            提醒
          </button>
        </div>
      </header>

      {view === 'week' ? (
        <div className="calendar-workspace">
          <section className="week-calendar functional-week">
            <div className="week-allday" aria-label="全天">
              <span className="allday-label">全天</span>
              {days.map((day) => {
                const dateStr = iso(day)
                const allDayEvents = events.filter((item) => item.date === dateStr && isAllDayKind(item.kind))
                const allDayReminders = remindersOn(dateStr).filter(
                  (item) => reminderTimeSlot(item.scheduledAt, times) == null,
                )
                const hot =
                  allDayEvents.some((item) => item.id === activeEventId) ||
                  allDayReminders.some((item) => item.id === activeEventId)
                return (
                  <div
                    className={`allday-cell${dateStr === todayStr ? ' today-column' : ''}${dateStr === selectedDay ? ' is-selected' : ''}${hot ? ' is-hot' : ''}`}
                    key={dateStr}
                  >
                    {allDayEvents.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`allday-chip event-${item.kind}${item.done ? ' is-done' : ''}${item.id === activeEventId ? ' is-active' : ''}`}
                        onClick={() => openItem(item)}
                        title={`${itemActionLabel(item)}：${item.title}`}
                      >
                        {item.title}
                      </button>
                    ))}
                    {allDayReminders.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`allday-chip event-reminder${item.status !== 'pending' ? ' is-done' : ''}${item.id === activeEventId ? ' is-active' : ''}`}
                        onClick={() => openReminder(item)}
                        title={`提醒 ${reminderClock(item.scheduledAt)}：${item.title}`}
                      >
                        {reminderClock(item.scheduledAt)} {item.title}
                      </button>
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
                  <button
                    type="button"
                    key={dateStr}
                    className={`week-day-btn${dateStr === todayStr ? ' today-column' : ''}${dateStr === selectedDay ? ' is-selected' : ''}`}
                    onClick={() => {
                      setSelectedDay(dateStr)
                      setActiveEventId(null)
                    }}
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
                  const timedEvents = events.filter((item) => item.date === dateStr && !isAllDayKind(item.kind))
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
                    <div
                      className={`day-column${dateStr === todayStr ? ' today-column' : ''}${dateStr === selectedDay ? ' is-selected' : ''}`}
                      key={dateStr}
                      onClick={() => {
                        setSelectedDay(dateStr)
                        setActiveEventId(null)
                      }}
                    >
                      {times.map((_, row) => {
                        const hot =
                          Boolean(activeEventId) &&
                          (timedEvents.some(
                            (item) =>
                              item.id === activeEventId &&
                              row >= item.start &&
                              row < item.start + Math.max(1, item.length),
                          ) ||
                            timedReminders.some(
                              (entry) => entry.item.id === activeEventId && row >= entry.start && row < entry.start + 1,
                            ))
                        return <span className={`grid-cell${hot ? ' is-hot' : ''}`} key={row} />
                      })}
                      {timedEvents.map((item) => (
                        <button
                          type="button"
                          className={`calendar-event event-${item.kind}${item.done ? ' is-done' : ''}${item.id === activeEventId ? ' is-active' : ''}`}
                          style={
                            {
                              '--event-start': item.start,
                              '--event-length': item.length,
                              '--event-lane': laneOf.get(item.id) ?? 0,
                              '--event-cols': cols,
                            } as React.CSSProperties
                          }
                          key={item.id}
                          title={`${item.title} · ${itemSubline(item)} · ${itemActionLabel(item)}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openItem(item)
                          }}
                        >
                          <b>{item.title}</b>
                          <span>{item.detail}</span>
                        </button>
                      ))}
                      {timedReminders.map((entry) => (
                        <button
                          type="button"
                          className={`calendar-event event-reminder${entry.item.status !== 'pending' ? ' is-done' : ''}${entry.item.id === activeEventId ? ' is-active' : ''}`}
                          style={
                            {
                              '--event-start': entry.start,
                              '--event-length': entry.length,
                              '--event-lane': laneOf.get(entry.item.id) ?? 0,
                              '--event-cols': cols,
                            } as React.CSSProperties
                          }
                          key={entry.item.id}
                          title={`提醒 ${reminderClock(entry.item.scheduledAt)}：${entry.item.title}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openReminder(entry.item)
                          }}
                        >
                          <b>{entry.item.title}</b>
                          <span>{reminderClock(entry.item.scheduledAt)}</span>
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
                const list = marksOn(dateStr)
                const selected = dateStr === selectedDay
                return (
                  <button
                    type="button"
                    className={`${day.getMonth() === cursor.getMonth() ? '' : 'other-month'} ${selected ? 'is-selected' : ''} ${dateStr === todayStr ? 'is-today' : ''}`}
                    key={dateStr}
                    onClick={() => selectMonthDay(day)}
                    aria-label={`${formatDayLabel(day)}，${list.length ? `${list.length} 项安排` : '暂无安排'}`}
                  >
                    <strong>{day.getDate()}</strong>
                    {list.slice(0, 3).map((item) => (
                      <span className={`month-event event-${item.kind}${item.done ? ' is-done' : ''}`} key={item.id}>
                        {item.title}
                      </span>
                    ))}
                    {list.length > 3 && <small>还有 {list.length - 3} 项</small>}
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="calendar-side month-side">{dayPanel}</aside>
        </div>
      )}

      {peek && (
        <div className="calendar-modal-backdrop" onMouseDown={() => setPeek(null)}>
          <div
            ref={peekRef}
            className="calendar-composer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-course-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="composer-heading">
              <div>
                <p className="section-label">课程</p>
                <h2 id="calendar-course-dialog-title">{peek.title}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setPeek(null)} aria-label="关闭">
                ×
              </button>
            </div>
            <p className="composer-hint">{peek.detail}</p>
            <div className="composer-actions">
              <button type="button" className="delete-action" onClick={() => void dropCourse(peek)}>
                本节省课
              </button>
              <span />
              <button type="button" className="outline-action" onClick={() => setPeek(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {editor && (
        <div className="calendar-modal-backdrop" onMouseDown={() => setEditor(null)}>
          <form
            ref={editorRef}
            className="calendar-composer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-editor-dialog-title"
            onSubmit={save}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="composer-heading">
              <div>
                <p className="section-label">{editor.id ? '编辑日程' : '新建日程'}</p>
                <h2 id="calendar-editor-dialog-title">{editor.id ? '修改安排' : '添加安排'}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setEditor(null)} aria-label="关闭">
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
                      start: isAllDayKind(kind) ? 0 : editor.start || 6,
                      length: isAllDayKind(kind) ? 1 : editor.length || 1,
                    })
                  }}
                >
                  {CREATABLE_KINDS.map((value) => (
                    <option value={value} key={value}>
                      {labels[value]}
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
                  持续时段
                  <select
                    value={editor.length}
                    onChange={(event) => setEditor({ ...editor, length: Number(event.target.value) })}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option value={n} key={n}>
                        {n} 个时段
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {editor.kind === 'deadline' && (
              <>
                <p className="composer-hint">截止日期出现在全天行。保存后可从日程跳到对应页面。</p>
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
                    <option value="papers:">论文指导</option>
                    <option value="courses:">教学</option>
                    <option value="tasks:">教学看板</option>
                  </select>
                </label>
              </>
            )}
            {editor.id && (
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={Boolean(editor.done)}
                  onChange={(event) => setEditor({ ...editor, done: event.target.checked })}
                />
                已完成
              </label>
            )}
            <div className="composer-actions">
              {editor.id && (
                <button type="button" className="delete-action" onClick={remove}>
                  删除
                </button>
              )}
              <span />
              <button type="button" className="outline-action" onClick={() => setEditor(null)}>
                取消
              </button>
              <button type="submit" className="primary-action">
                保存
              </button>
            </div>
          </form>
        </div>
      )}

      {reminderEditor && (
        <div className="calendar-modal-backdrop" onMouseDown={closeReminderEditor}>
          <form
            ref={reminderRef}
            className="calendar-composer reminder-composer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-reminder-dialog-title"
            onSubmit={saveReminder}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="composer-heading">
              <div>
                <p className="section-label">{reminderEditor.id ? '编辑提醒' : '新建提醒'}</p>
                <h2 id="calendar-reminder-dialog-title">{reminderEditor.id ? '修改提醒' : '到点通知我'}</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeReminderEditor} aria-label="关闭">
                ×
              </button>
            </div>
            <label className="reminders-ai-field">
              用一句话描述
              <textarea
                value={aiInput}
                onChange={(event) => {
                  setAiInput(event.target.value)
                  setAiPreview(null)
                }}
                rows={2}
                placeholder="例如：后天上午8点半提醒准备实习巡视材料"
              />
            </label>
            <div className="composer-actions reminder-ai-actions">
              <button type="button" className="outline-action" onClick={parseAiReminder} disabled={!aiInput.trim()}>
                智能解析
              </button>
            </div>
            {aiPreview && (
              <p className="composer-hint">
                {aiPreview.explanation} · 置信度
                {aiPreview.confidence === 'high' ? '高' : aiPreview.confidence === 'medium' ? '中' : '低'}
              </p>
            )}
            <label>
              提醒标题
              <input
                autoFocus
                required
                value={reminderEditor.title}
                onChange={(event) => setReminderEditor({ ...reminderEditor, title: event.target.value })}
                placeholder="例如：录入期中成绩"
              />
            </label>
            <label>
              提醒时间
              <input
                required
                type="datetime-local"
                value={toDatetimeLocalInput(reminderEditor.scheduledAt)}
                onChange={(event) =>
                  setReminderEditor({
                    ...reminderEditor,
                    scheduledAt: fromDatetimeLocalInput(event.target.value),
                    source: reminderEditor.rawInput ? reminderEditor.source : 'manual',
                  })
                }
              />
            </label>
            <label>
              备注（可选）
              <input
                value={reminderEditor.note}
                onChange={(event) => setReminderEditor({ ...reminderEditor, note: event.target.value })}
                placeholder="补充说明"
              />
            </label>
            {canNotify && (
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={settings.systemNotifyEnabled && permission === 'granted'}
                  onChange={() => void enableSystemNotify()}
                />
                到点推送到系统通知
              </label>
            )}
            {!canNotify && <p className="composer-hint">当前环境不支持系统通知，将仅使用应用内提醒。应用需保持打开才能准时提醒。</p>}
            {reminderEditor.id && (
              <div className="reminder-snooze">
                <button
                  type="button"
                  className="text-action"
                  onClick={() => {
                    const item = reminders.find((entry) => entry.id === reminderEditor.id)
                    if (item) snoozeReminder(item, 10)
                  }}
                >
                  +10 分
                </button>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => {
                    const item = reminders.find((entry) => entry.id === reminderEditor.id)
                    if (item) snoozeReminder(item, 60)
                  }}
                >
                  +1 时
                </button>
                {reminders.find((item) => item.id === reminderEditor.id)?.status === 'pending' && (
                  <button type="button" className="text-action" onClick={() => cancelReminder(reminderEditor.id)}>
                    取消提醒
                  </button>
                )}
              </div>
            )}
            <div className="composer-actions">
              {reminderEditor.id && (
                <button type="button" className="delete-action" onClick={() => void removeReminder(reminderEditor.id)}>
                  删除
                </button>
              )}
              <span />
              <button type="button" className="outline-action" onClick={closeReminderEditor}>
                取消
              </button>
              <button type="submit" className="primary-action">
                保存
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
