import { useMemo, useState } from 'react'
import { uid } from '../data/store'
import type { ReminderItem, ReminderSettings } from '../data/types'
import { formatReminderTime, parseReminderNaturalLanguage, toLocalDateTimeIso, type ParsedReminder } from '../lib/reminder-nlp'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'
import {
  notificationPermission,
  notificationSupported,
  requestNotificationPermission,
} from '../lib/system-notify'

type ManualDraft = {
  title: string
  scheduledAt: string
  note: string
}

type Props = {
  reminders: ReminderItem[]
  settings: ReminderSettings
  onChangeReminders: (items: ReminderItem[]) => void
  onChangeSettings: (settings: ReminderSettings) => void
}

const emptyManual: ManualDraft = { title: '', scheduledAt: '', note: '' }

const defaultDatetimeLocal = () => {
  const date = new Date(Date.now() + 60 * 60_000)
  date.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function RemindersPage({ reminders, settings, onChangeReminders, onChangeSettings }: Props) {
  const [tab, setTab] = useState<'manual' | 'ai'>('ai')
  const [manual, setManual] = useState<ManualDraft>({ ...emptyManual, scheduledAt: defaultDatetimeLocal() })
  const [aiInput, setAiInput] = useState('')
  const [aiPreview, setAiPreview] = useState<ParsedReminder | null>(null)

  const pending = useMemo(
    () =>
      reminders
        .filter((item) => item.status === 'pending')
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [reminders],
  )
  const history = useMemo(
    () =>
      reminders
        .filter((item) => item.status !== 'pending')
        .sort((a, b) => (b.firedAt ?? b.createdAt).localeCompare(a.firedAt ?? a.createdAt)),
    [reminders],
  )

  const permission = notificationPermission()
  const canNotify = notificationSupported()

  const addReminder = (item: Omit<ReminderItem, 'id' | 'createdAt' | 'status'> & { status?: ReminderItem['status'] }) => {
    const next: ReminderItem = {
      id: uid('rem'),
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...item,
    }
    onChangeReminders([next, ...reminders])
    notify.success(`已添加提醒「${next.title}」`)
  }

  const parseAi = () => {
    const parsed = parseReminderNaturalLanguage(aiInput)
    if (!parsed) {
      notify.warning('未能识别时间，请包含如「明天下午3点」「30分钟后」等表达')
      setAiPreview(null)
      return
    }
    setAiPreview(parsed)
  }

  const confirmAi = () => {
    if (!aiPreview) return
    addReminder({
      title: aiPreview.title,
      scheduledAt: aiPreview.scheduledAt,
      source: 'ai',
      rawInput: aiInput.trim(),
    })
    setAiInput('')
    setAiPreview(null)
  }

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault()
    if (!manual.title.trim() || !manual.scheduledAt) return
    addReminder({
      title: manual.title.trim(),
      note: manual.note.trim() || undefined,
      scheduledAt: `${manual.scheduledAt}:00`,
      source: 'manual',
    })
    setManual({ ...emptyManual, scheduledAt: defaultDatetimeLocal() })
  }

  const cancelReminder = (id: string) => {
    onChangeReminders(reminders.map((item) => (item.id === id ? { ...item, status: 'cancelled' } : item)))
    notify.info('已取消提醒')
  }

  const snoozeReminder = (item: ReminderItem, minutes: number) => {
    const nextTime = toLocalDateTimeIso(new Date(new Date(item.scheduledAt).getTime() + minutes * 60_000))
    onChangeReminders(
      reminders.map((entry) =>
        entry.id === item.id ? { ...entry, scheduledAt: nextTime, status: 'pending', firedAt: undefined } : entry,
      ),
    )
    notify.success(`已推迟 ${minutes} 分钟`)
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
  }

  const enableSystemNotify = async () => {
    const result = await requestNotificationPermission()
    if (result === 'granted') {
      onChangeSettings({ ...settings, systemNotifyEnabled: true })
      notify.success('系统通知已开启')
      return
    }
    if (result === 'denied') notify.error('系统通知被拒绝，请在浏览器或系统设置中允许')
    else notify.info('当前环境不支持系统通知，将仅使用应用内提醒')
  }

  return (
    <section className="reminders-page" aria-label="通知提醒">
      <div className="reminders-heading">
        <div>
          <p className="section-label">工作台</p>
          <h1>通知提醒</h1>
          <p>手动或自然语言设置定时提醒 · 应用打开时触发系统通知</p>
        </div>
        {canNotify && permission !== 'granted' && (
          <button type="button" className="primary-action" onClick={enableSystemNotify}>
            开启系统通知
          </button>
        )}
        {canNotify && permission === 'granted' && (
          <button
            type="button"
            className={settings.systemNotifyEnabled ? 'outline-action' : 'primary-action'}
            onClick={() => {
              if (!settings.systemNotifyEnabled) {
                onChangeSettings({ ...settings, systemNotifyEnabled: true })
                notify.success('系统通知已开启')
                return
              }
              onChangeSettings({ ...settings, systemNotifyEnabled: false })
              notify.info('已切换为仅应用内提醒')
            }}
          >
            {settings.systemNotifyEnabled ? '系统通知：开' : '系统通知：关'}
          </button>
        )}
      </div>

      <div className="reminders-notice">
        <span aria-hidden="true">ℹ</span>
        <span>
          AI 自然语言在本地解析，无需联网。示例：「明天下午3点提醒批改作业」「30分钟后提醒我开会」。应用需保持打开才能准时提醒。
        </span>
      </div>

      <div className="reminders-overview">
        <div>
          <span>待触发</span>
          <strong>{pending.length}</strong>
          <small>按时间排序</small>
        </div>
        <div>
          <span>系统通知</span>
          <strong>{settings.systemNotifyEnabled && permission === 'granted' ? '开' : '关'}</strong>
          <small>{canNotify ? 'macOS / 手机通知中心' : '当前环境不支持'}</small>
        </div>
        <div>
          <span>历史记录</span>
          <strong>{history.length}</strong>
          <small>已触发或已取消</small>
        </div>
      </div>

      <div className="reminders-composers">
        <div className="reminders-tabs" role="tablist" aria-label="添加方式">
          <button type="button" role="tab" aria-selected={tab === 'ai'} className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
            AI 自然语言
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'manual'}
            className={tab === 'manual' ? 'active' : ''}
            onClick={() => setTab('manual')}
          >
            手动设置
          </button>
        </div>

        {tab === 'ai' ? (
          <div className="reminders-panel">
            <label className="reminders-ai-field">
              <span>用一句话描述提醒</span>
              <textarea
                value={aiInput}
                onChange={(event) => {
                  setAiInput(event.target.value)
                  setAiPreview(null)
                }}
                rows={3}
                placeholder="例如：后天上午8点半提醒准备实习巡视材料"
              />
            </label>
            <div className="reminders-panel-actions">
              <button type="button" className="outline-action" onClick={parseAi} disabled={!aiInput.trim()}>
                智能解析
              </button>
              <button type="button" className="primary-action" onClick={confirmAi} disabled={!aiPreview}>
                确认添加
              </button>
            </div>
            {aiPreview && (
              <div className="reminders-preview">
                <p className="section-label">解析结果</p>
                <strong>{aiPreview.title}</strong>
                <span>{aiPreview.explanation}</span>
                <em>置信度：{aiPreview.confidence === 'high' ? '高' : aiPreview.confidence === 'medium' ? '中' : '低'}</em>
              </div>
            )}
          </div>
        ) : (
          <form className="reminders-panel" onSubmit={submitManual}>
            <label>
              提醒标题
              <input
                required
                value={manual.title}
                onChange={(event) => setManual({ ...manual, title: event.target.value })}
                placeholder="例如：录入期中成绩"
              />
            </label>
            <label>
              提醒时间
              <input
                required
                type="datetime-local"
                value={manual.scheduledAt}
                onChange={(event) => setManual({ ...manual, scheduledAt: event.target.value })}
              />
            </label>
            <label>
              备注（可选）
              <input
                value={manual.note}
                onChange={(event) => setManual({ ...manual, note: event.target.value })}
                placeholder="补充说明"
              />
            </label>
            <div className="reminders-panel-actions">
              <button type="submit" className="primary-action">
                添加提醒
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="reminders-list-section">
        <div className="reminders-list-head">
          <h2>待触发提醒</h2>
          <span>{pending.length} 条</span>
        </div>
        {pending.length === 0 ? (
          <div className="reminders-empty">暂无待触发提醒，试试用自然语言添加一条</div>
        ) : (
          <div className="reminders-list">
            {pending.map((item) => (
              <article key={item.id} className="reminder-row">
                <div className="reminder-row-main">
                  <strong>{item.title}</strong>
                  {item.note && <small>{item.note}</small>}
                  <span>
                    {formatReminderTime(item.scheduledAt)}
                    {item.source === 'ai' && ' · AI 解析'}
                  </span>
                  {item.rawInput && <em>「{item.rawInput}」</em>}
                </div>
                <div className="reminder-row-actions">
                  <button type="button" className="text-action" onClick={() => snoozeReminder(item, 10)}>
                    +10 分
                  </button>
                  <button type="button" className="text-action" onClick={() => snoozeReminder(item, 60)}>
                    +1 时
                  </button>
                  <button type="button" className="text-action" onClick={() => cancelReminder(item.id)}>
                    取消
                  </button>
                  <button type="button" className="text-action is-danger" onClick={() => removeReminder(item.id)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="reminders-list-section reminders-history">
          <div className="reminders-list-head">
            <h2>历史记录</h2>
            <span>{history.length} 条</span>
          </div>
          <div className="reminders-list">
            {history.map((item) => (
              <article key={item.id} className={`reminder-row is-${item.status}`}>
                <div className="reminder-row-main">
                  <strong>{item.title}</strong>
                  <span>
                    {formatReminderTime(item.scheduledAt)} · {item.status === 'fired' ? '已触发' : '已取消'}
                  </span>
                </div>
                <button type="button" className="text-action is-danger" onClick={() => removeReminder(item.id)}>
                  删除
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
