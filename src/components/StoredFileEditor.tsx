import { useEffect, useRef, useState } from 'react'
import { notify } from '../lib/notify'
import { optimizeResearchText } from '../lib/research-optimize'
import {
  canPreviewFile,
  downloadStoredFile,
  formatFileSize,
  getResourceFile,
  openStoredFile,
  putResourceFile,
} from '../lib/resource-files'

type Props = {
  fileId?: string
  fileName?: string
  mimeType?: string
  title: string
  note?: string
  extractedText?: string
  smartOptimize?: boolean
  readOnly?: boolean
  onOpenSettings?: () => void
  onMeta: (patch: { title?: string; note?: string; extractedText?: string; fileName?: string; mimeType?: string; size?: string }) => void
}

export function StoredFileEditor({
  fileId,
  fileName,
  mimeType,
  title,
  note,
  extractedText,
  smartOptimize,
  readOnly,
  onOpenSettings,
  onMeta,
}: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [previousText, setPreviousText] = useState<string | null>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const previewable = canPreviewFile(mimeType, fileName)

  useEffect(() => {
    if (!fileId) {
      setUrl(null)
      return
    }
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
    if (!fileId) return
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

  const optimize = async () => {
    if (!extractedText?.trim()) {
      notify.warning('请先输入正文，再进行智能优化')
      return
    }
    setOptimizing(true)
    try {
      const next = await optimizeResearchText({ title, text: extractedText, note })
      setPreviousText(extractedText)
      onMeta({ extractedText: next })
      notify.success('已完成优化，可随时撤销')
    } catch (error) {
      const message = error instanceof Error ? error.message : '优化失败'
      notify.error(message)
      if (message.includes('配置模型接口')) onOpenSettings?.()
    } finally {
      setOptimizing(false)
    }
  }

  return (
    <div className={`file-editor${fileId ? '' : ' is-text-only'}`}>
      {fileId && <div className="file-editor-preview">
        {previewable && url && mimeType?.startsWith('image/') && <img src={url} alt={fileName || title} />}
        {previewable && url && (mimeType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf')) && (
          <iframe title={fileName || title} src={url} />
        )}
        {previewable && url && mimeType?.startsWith('text/') && <iframe title={fileName || title} src={url} />}
        {(!previewable || !url) && <p>此格式可下载后编辑，或点打开查看。</p>}
      </div>}
      <div className="file-editor-fields">
        <label>
          名称
          <input readOnly={readOnly} value={title} onChange={(event) => onMeta({ title: event.target.value })} />
        </label>
        <label>
          处理备注
          <textarea
            rows={3}
            readOnly={readOnly}
            value={note ?? ''}
            onChange={(event) => onMeta({ note: event.target.value })}
            placeholder="记下要改的地方、提交口径、还缺什么材料"
          />
        </label>
        <label>
          在线正文
          <textarea
            rows={10}
            readOnly={readOnly}
            value={extractedText ?? ''}
            onChange={(event) => onMeta({ extractedText: event.target.value })}
            placeholder="上传文件后会尽量识别正文，也可以在这里直接撰写"
          />
        </label>
        <div className="work-materials-actions">
          {smartOptimize && !readOnly && (
            <button type="button" className="primary-action" disabled={optimizing} onClick={() => void optimize()}>
              {optimizing ? '正在优化…' : '智能优化'}
            </button>
          )}
          {previousText !== null && !readOnly && (
            <button
              type="button"
              className="text-action"
              onClick={() => {
                onMeta({ extractedText: previousText })
                setPreviousText(null)
                notify.info('已撤销本次优化')
              }}
            >
              撤销优化
            </button>
          )}
          {fileId && <button type="button" className="text-action" onClick={() => void openStoredFile(fileId)}>
            打开
          </button>}
          {fileId && <button type="button" className="text-action" onClick={() => void downloadStoredFile(fileId)}>
            下载
          </button>}
          {fileId && !readOnly && <button type="button" className="text-action" onClick={() => replaceRef.current?.click()}>
            替换文件
          </button>}
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
