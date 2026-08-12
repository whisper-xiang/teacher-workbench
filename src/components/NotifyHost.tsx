import { useEffect, useState } from 'react'
import { closeNotify, subscribeNotify, type NotifyItem, type NotifyType } from '../lib/notify'
import './notify.css'

const icons: Record<NotifyType, string> = {
  success: '✓',
  warning: '!',
  info: 'i',
  error: '×',
}

export function NotifyHost() {
  const [items, setItems] = useState<NotifyItem[]>([])

  useEffect(() => {
    const unsubscribe = subscribeNotify(setItems)
    return () => {
      unsubscribe()
    }
  }, [])

  if (!items.length) return null

  return (
    <div className="el-notify-stack" aria-live="polite" aria-relevant="additions">
      {items.map((item) => (
        <article key={item.id} className={`el-notify el-notify--${item.type}`} role="status">
          <span className="el-notify-icon" aria-hidden="true">
            {icons[item.type]}
          </span>
          <div className="el-notify-body">
            {item.title && <h3 className="el-notify-title">{item.title}</h3>}
            <p className="el-notify-message">{item.message}</p>
          </div>
          {item.showClose && (
            <button className="el-notify-close" onClick={() => closeNotify(item.id)} aria-label="关闭通知">
              ×
            </button>
          )}
        </article>
      ))}
    </div>
  )
}
