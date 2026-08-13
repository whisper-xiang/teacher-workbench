export type ConfirmType = 'warning' | 'info' | 'success' | 'error'

export type ConfirmOptions = {
  title?: string
  message: string
  type?: ConfirmType
  confirmButtonText?: string
  cancelButtonText?: string
  showCancelButton?: boolean
  closeOnClickModal?: boolean
  showClose?: boolean
  confirmButtonClass?: 'primary' | 'danger'
}

export type ConfirmItem = ConfirmOptions & {
  id: string
}

type ConfirmAction = 'confirm' | 'cancel' | 'close'

type PendingConfirm = ConfirmItem & {
  resolve: () => void
  reject: (reason: 'cancel' | 'close') => void
}

type Listener = (item: ConfirmItem | null) => void

let pending: PendingConfirm | null = null
const listeners = new Set<Listener>()

function emit() {
  const snapshot = pending
    ? {
        id: pending.id,
        title: pending.title,
        message: pending.message,
        type: pending.type,
        confirmButtonText: pending.confirmButtonText,
        cancelButtonText: pending.cancelButtonText,
        showCancelButton: pending.showCancelButton,
        closeOnClickModal: pending.closeOnClickModal,
        showClose: pending.showClose,
        confirmButtonClass: pending.confirmButtonClass,
      }
    : null
  listeners.forEach((listener) => listener(snapshot))
}

function uid() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeOptions(
  input: string | ConfirmOptions,
  title?: string,
  extra?: Partial<ConfirmOptions>,
): ConfirmOptions {
  const base: ConfirmOptions =
    typeof input === 'string'
      ? { message: input, title: title ?? '提示' }
      : { title: '提示', ...input }

  return {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    showCancelButton: true,
    closeOnClickModal: true,
    showClose: true,
    confirmButtonClass: base.type === 'error' || base.type === 'warning' ? 'danger' : 'primary',
    ...base,
    ...extra,
  }
}

function settle(action: ConfirmAction) {
  if (!pending) return
  const current = pending
  pending = null
  emit()
  if (action === 'confirm') current.resolve()
  else current.reject(action === 'cancel' ? 'cancel' : 'close')
}

export function subscribeConfirm(listener: Listener) {
  listeners.add(listener)
  listener(
    pending
      ? {
          id: pending.id,
          title: pending.title,
          message: pending.message,
          type: pending.type,
          confirmButtonText: pending.confirmButtonText,
          cancelButtonText: pending.cancelButtonText,
          showCancelButton: pending.showCancelButton,
          closeOnClickModal: pending.closeOnClickModal,
          showClose: pending.showClose,
          confirmButtonClass: pending.confirmButtonClass,
        }
      : null,
  )
  return () => listeners.delete(listener)
}

export function closeConfirm(action: ConfirmAction = 'close') {
  settle(action)
}

export function confirm(
  input: string | ConfirmOptions,
  title?: string,
  options?: Partial<ConfirmOptions>,
): Promise<void> {
  const opts = normalizeOptions(input, title, options)

  return new Promise((resolve, reject) => {
    if (pending) pending.reject('cancel')

    pending = {
      id: uid(),
      ...opts,
      resolve,
      reject,
    }
    emit()
  })
}

confirm.warning = (message: string, title = '提示', options?: Partial<ConfirmOptions>) =>
  confirm({ message, title, type: 'warning', ...options })
confirm.info = (message: string, title = '提示', options?: Partial<ConfirmOptions>) =>
  confirm({ message, title, type: 'info', ...options })
confirm.success = (message: string, title = '提示', options?: Partial<ConfirmOptions>) =>
  confirm({ message, title, type: 'success', ...options })
confirm.error = (message: string, title = '错误', options?: Partial<ConfirmOptions>) =>
  confirm({ message, title, type: 'error', ...options })
confirm.delete = (message: string, title = '确认删除', options?: Partial<ConfirmOptions>) =>
  confirm({
    message,
    title,
    type: 'warning',
    confirmButtonText: '删除',
    confirmButtonClass: 'danger',
    ...options,
  })
