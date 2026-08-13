import { useEffect, useState } from 'react'
import { closeConfirm, subscribeConfirm, type ConfirmItem, type ConfirmType } from '../lib/confirm'
import './confirm.css'

const icons: Record<ConfirmType, string> = {
  warning: '!',
  info: 'i',
  success: '✓',
  error: '×',
}

export function ConfirmHost() {
  const [item, setItem] = useState<ConfirmItem | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeConfirm(setItem)
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!item) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeConfirm('close')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item])

  if (!item) return null

  const type = item.type ?? 'warning'

  return (
    <div className="el-message-box-overlay" role="presentation" onMouseDown={() => item.closeOnClickModal !== false && closeConfirm('close')}>
      <div
        className={`el-message-box el-message-box--${type}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="el-message-box-title"
        aria-describedby="el-message-box-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="el-message-box__header">
          <div className="el-message-box__title-wrap">
            <span className="el-message-box__status" aria-hidden="true">
              {icons[type]}
            </span>
            <h2 id="el-message-box-title" className="el-message-box__title">
              {item.title}
            </h2>
          </div>
          {item.showClose !== false && (
            <button type="button" className="el-message-box__close" aria-label="关闭" onClick={() => closeConfirm('close')}>
              ×
            </button>
          )}
        </div>
        <p id="el-message-box-message" className="el-message-box__message">
          {item.message}
        </p>
        <div className="el-message-box__footer">
          {item.showCancelButton !== false && (
            <button type="button" className="el-message-box__btn el-message-box__btn--default" onClick={() => closeConfirm('cancel')}>
              {item.cancelButtonText ?? '取消'}
            </button>
          )}
          <button
            type="button"
            className={`el-message-box__btn el-message-box__btn--${item.confirmButtonClass ?? 'primary'}`}
            autoFocus
            onClick={() => closeConfirm('confirm')}
          >
            {item.confirmButtonText ?? '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
