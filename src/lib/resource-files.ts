const DB_NAME = 'teacher-workbench-files'
const STORE = 'blobs'
const DB_VERSION = 1
const MAX_BYTES = 80 * 1024 * 1024

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开本地文件库'))
  })
}

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('本地文件操作失败'))
  })
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function inferResourceFormat(name: string, mime = ''): 'PPT' | 'DOC' | 'PDF' | 'MP4' | '其他' {
  const lower = `${name} ${mime}`.toLowerCase()
  if (/\.pptx?(\b|$)/.test(lower) || lower.includes('powerpoint') || lower.includes('presentation')) return 'PPT'
  if (/\.docx?(\b|$)/.test(lower) || lower.includes('word') || lower.includes('msword')) return 'DOC'
  if (/\.pdf(\b|$)/.test(lower) || lower.includes('pdf')) return 'PDF'
  if (/\.(mp4|webm|mov)(\b|$)/.test(lower) || lower.includes('video')) return 'MP4'
  return '其他'
}

export async function putResourceFile(id: string, file: Blob, name = 'file') {
  if (file.size > MAX_BYTES) {
    throw new Error(`文件超过 ${formatFileSize(MAX_BYTES)}，请压缩后再上传`)
  }
  const db = await openDb()
  try {
    await asPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put({ blob: file, name, type: file.type }, id))
  } finally {
    db.close()
  }
}

export async function getResourceFile(id: string): Promise<{ blob: Blob; name: string; type: string } | undefined> {
  const db = await openDb()
  try {
    const row = await asPromise<{ blob: Blob; name: string; type: string } | undefined>(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(id),
    )
    return row
  } finally {
    db.close()
  }
}

export async function deleteResourceFile(id: string) {
  const db = await openDb()
  try {
    await asPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
  } finally {
    db.close()
  }
}

export async function clearAllResourceFiles() {
  const db = await openDb()
  try {
    await asPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).clear())
  } finally {
    db.close()
  }
}

export async function openStoredFile(id: string) {
  const stored = await getResourceFile(id)
  if (!stored) throw new Error('找不到本地文件，可能已被清理')
  const url = URL.createObjectURL(stored.blob)
  const preview = stored.type.startsWith('image/') || stored.type === 'application/pdf' || stored.type.startsWith('text/')
  if (preview) {
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = stored.name || '教学资源'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
