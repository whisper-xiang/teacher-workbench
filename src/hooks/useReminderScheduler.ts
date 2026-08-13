import { useEffect, useRef } from 'react'
import type { ReminderItem, ReminderSettings } from '../data/types'
import { notify } from '../lib/notify'
import { showSystemNotification } from '../lib/system-notify'

type Options = {
  reminders: ReminderItem[]
  settings: ReminderSettings
  onFire: (id: string, firedAt: string) => void
}

export function useReminderScheduler({ reminders, settings, onFire }: Options) {
  const firedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      for (const item of reminders) {
        if (item.status !== 'pending') continue
        const due = new Date(item.scheduledAt).getTime()
        if (Number.isNaN(due) || due > now) continue
        if (firedRef.current.has(item.id)) continue

        firedRef.current.add(item.id)
        const firedAt = new Date().toISOString()

        if (settings.systemNotifyEnabled) {
          showSystemNotification({
            title: item.title,
            body: item.note || '你设置的提醒时间到了',
            tag: item.id,
            onClickPath: '#/reminders',
          })
        }

        notify.info(item.note ? `${item.title} · ${item.note}` : item.title, '提醒')
        onFire(item.id, firedAt)
      }
    }

    tick()
    const timer = window.setInterval(tick, 15_000)
    return () => window.clearInterval(timer)
  }, [reminders, settings.systemNotifyEnabled, onFire])
}
