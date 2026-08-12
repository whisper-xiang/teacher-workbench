export type NotifyType = 'success' | 'warning' | 'info' | 'error'

export type NotifyOptions = {
  title?: string
  message: string
  type?: NotifyType
  duration?: number
  showClose?: boolean
}

export type NotifyItem = NotifyOptions & {
  id: string
  type: NotifyType
  duration: number
  showClose: boolean
  createdAt: number
}

type Listener = (items: NotifyItem[]) => void

let items: NotifyItem[] = []
const listeners = new Set<Listener>()
const timers = new Map<string, number>()

function emit() {
  listeners.forEach((listener) => listener([...items]))
}

function uid() {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function subscribeNotify(listener: Listener) {
  listeners.add(listener)
  listener([...items])
  return () => {
    listeners.delete(listener)
  }
}

export function closeNotify(id: string) {
  const timer = timers.get(id)
  if (timer) {
    window.clearTimeout(timer)
    timers.delete(id)
  }
  items = items.filter((item) => item.id !== id)
  emit()
}

export function clearNotify() {
  timers.forEach((timer) => window.clearTimeout(timer))
  timers.clear()
  items = []
  emit()
}

export function notify(input: string | NotifyOptions) {
  const options: NotifyOptions = typeof input === 'string' ? { message: input } : input
  const item: NotifyItem = {
    id: uid(),
    title: options.title,
    message: options.message,
    type: options.type ?? 'success',
    duration: options.duration ?? 3200,
    showClose: options.showClose ?? true,
    createdAt: Date.now(),
  }
  items = [item, ...items].slice(0, 5)
  emit()

  if (item.duration > 0) {
    const timer = window.setTimeout(() => closeNotify(item.id), item.duration)
    timers.set(item.id, timer)
  }

  return item.id
}

notify.success = (message: string, title = '成功') => notify({ message, title, type: 'success' })
notify.warning = (message: string, title = '提示') => notify({ message, title, type: 'warning' })
notify.info = (message: string, title = '通知') => notify({ message, title, type: 'info' })
notify.error = (message: string, title = '错误') => notify({ message, title, type: 'error' })
