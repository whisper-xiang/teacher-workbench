export type SystemNotifyPayload = {
  title: string
  body?: string
  tag?: string
  onClickPath?: string
}

export function notificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function showSystemNotification(payload: SystemNotifyPayload) {
  if (!notificationSupported() || Notification.permission !== 'granted') return false

  const notification = new Notification(payload.title, {
    body: payload.body,
    icon: '/favicon.svg',
    tag: payload.tag,
  })

  if (payload.onClickPath) {
    notification.onclick = () => {
      window.focus()
      window.location.hash = payload.onClickPath!
      notification.close()
    }
  }

  return true
}
