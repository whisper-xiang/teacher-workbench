import { useEffect, useRef, useState } from 'react'
import { notify } from '../lib/notify'
import {
  canPreviewFile,
  downloadStoredFile,
  formatFileSize,
  getResourceFile,
  openStoredFile,
  putResourceFile,
} from '../lib/resource-files'

type Props = {
  fileId: string
  fileName?: string
  mimeType?: string
  title: string
  note?: string
  extractedText?: string
  onMeta: (patch: { title?: string; note?: string; extractedText?: string; fileName?: string; mimeType?: string; size?: string }) => void
}

export function StoredFileEditor({ fileId, fileName, mimeType, title, note, extractedText, onMeta }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const previewable = canPreviewFile(mimeType, fileName)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    void getResourceFile(fileId).then((stored) => {
      if (cancelled || !stored) return
      objectUrl = URL.createObjectURL(stored.blob)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fileId])

  const replace = async (file: File) => {
    try {
      await putResourceFile(fileId, file, file.name)
      const nextUrl = URL.createObjectURL(file)
      setUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return nextUrl
      })
      onMeta({ fileName: file.name, mimeType: file.type, size: formatFileSize(file.size) })
      notify.success('文件已替换，可继续在这里处理')
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '替换失败')
    }
  }

  return (
    <div className="file-editor">
      <div className="file-editor-preview">
        {previewable && url && mimeType?.startsWith('image/') && <img src={url} alt={fileName || title} />}
        {previewable && url && (mimeType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf')) && (
          <iframe title={fileName || title} src={url} />
        )}
        {previewable && url && mimeType?.startsWith('text/') && <iframe title={fileName || title} src={url} />}
        {(!previewable || !url) && <p>此格式可下载后编辑，或点打开查看。</p>}
      </div>
      <div className="file-editor-fields">
        <label>
          名称
          <input value={title} onChange={(event) => onMeta({ title: event.target.value })} />
        </label>
        <label>
          处理备注
          <textarea
            rows={3}
            value={note ?? ''}
            onChange={(event) => onMeta({ note: event.target.value })}
            placeholder="记下要改的地方、提交口径、还缺什么材料"
          />
        </label>
        <label>
          识别文本
          <textarea
            rows={5}
            value={extractedText ?? ''}
            onChange={(event) => onMeta({ extractedText: event.target.value })}
            placeholder="能识别的正文会出现在这里，也可手工补全"
          />
        </label>
        <div className="work-materials-actions">
          <button type="button" className="text-action" onClick={() => void openStoredFile(fileId)}>
            打开
          </button>
          <button type="button" className="text-action" onClick={() => void downloadStoredFile(fileId)}>
            下载
          </button>
          <button type="button" className="text-action" onClick={() => replaceRef.current?.click()}>
            替换文件
          </button>
        </div>
        <input
          ref={replaceRef}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void replace(file)
            event.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
