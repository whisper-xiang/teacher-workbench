import { useState } from 'react'
import { uid } from '../data/store'
import type { WorkMaterial } from '../data/types'
import { fillIfEmpty, guessFromFile } from '../lib/intake-file'
import { confirm } from '../lib/confirm'
import { notify } from '../lib/notify'
import { deleteResourceFile, formatFileSize, openStoredFile, putResourceFile } from '../lib/resource-files'
import { FileIntake } from './FileIntake'
import { StoredFileEditor } from './StoredFileEditor'

type Props = {
  materials: WorkMaterial[]
  kinds: string[]
  onChange: (materials: WorkMaterial[]) => void
}

export function WorkMaterialsPanel({ materials, kinds, onChange }: Props) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState(kinds[0] ?? '其他')
  const [pending, setPending] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState('')

  const takeFile = async (file: File | null) => {
    setPending(file)
    if (!file) return
    setBusy(true)
    try {
      const guess = await guessFromFile(file, kinds)
      setTitle((current) => fillIfEmpty(current, guess.title))
      if (guess.kind) setKind(guess.kind)
      notify.info('已按文件识别名称，也可再改')
    } catch {
      setTitle((current) => fillIfEmpty(current, file.name.replace(/\.[^.]+$/, '')))
    } finally {
      setBusy(false)
    }
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = title.trim() || pending?.name || ''
    if (!name) {
      notify.warning('请填写资料名称或选择文件')
      return
    }
    const id = uid('mat')
    let fileId: string | undefined
    let fileName: string | undefined
    let mimeType: string | undefined
    let size = '—'
    let extractedText: string | undefined
    if (pending) {
      fileId = uid('file')
      try {
        await putResourceFile(fileId, pending, pending.name)
        extractedText = (await guessFromFile(pending, kinds)).extractedText
      } catch (error) {
        notify.error(error instanceof Error ? error.message : '文件保存失败')
        return
      }
      fileName = pending.name
      mimeType = pending.type
      size = formatFileSize(pending.size)
    }
    const next: WorkMaterial = {
      id,
      title: name,
      kind,
      fileId,
      fileName,
      mimeType,
      size,
      updated: '刚刚',
      extractedText,
    }
    onChange([next, ...materials])
    setTitle('')
    setPending(null)
    setEditingId(id)
    notify.success(pending ? `已保存「${name}」，可在下方处理` : `已记下「${name}」`)
  }

  const patch = (id: string, patch: Partial<WorkMaterial>) => {
    onChange(materials.map((item) => (item.id === id ? { ...item, ...patch, updated: '刚刚' } : item)))
  }

  const remove = async (item: WorkMaterial) => {
    try {
      await confirm.delete(`确定删除「${item.title}」？`)
    } catch {
      return
    }
    if (item.fileId) await deleteResourceFile(item.fileId).catch(() => undefined)
    onChange(materials.filter((row) => row.id !== item.id))
    if (editingId === item.id) setEditingId('')
    notify.warning(`已删除：${item.title}`, '已删除')
  }

  return (
    <div className="work-materials">
      <form className="work-materials-form is-intake" onSubmit={(event) => void add(event)}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="资料名称，可手填" />
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          {kinds.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="primary-action" type="submit" disabled={busy}>
          添加
        </button>
      </form>
      <FileIntake file={pending} onFile={(file) => void takeFile(file)} busy={busy} />
      <ul className="work-materials-list">
        {materials.map((item) => (
          <li key={item.id} className={editingId === item.id ? 'is-editing' : ''}>
            <span className="resource-type-pill">{item.kind}</span>
            <div>
              <strong>{item.title}</strong>
              <small>
                {item.fileName ? item.fileName : '未上传文件'}
                {item.size && item.size !== '—' ? ` · ${item.size}` : ''}
                {item.processedAt ? ' · 已处理' : ''}
                {` · ${item.updated}`}
              </small>
            </div>
            <div className="work-materials-actions">
              {item.fileId && (
                <button type="button" className="text-action" onClick={() => void openStoredFile(item.fileId!)}>
                  预览
                </button>
              )}
              <button
                type="button"
                className="text-action"
                onClick={() => setEditingId((current) => (current === item.id ? '' : item.id))}
              >
                {editingId === item.id ? '收起' : '处理'}
              </button>
              <button
                type="button"
                className="text-action"
                onClick={() =>
                  patch(item.id, { processedAt: item.processedAt ? undefined : new Date().toISOString() })
                }
              >
                {item.processedAt ? '取消已处理' : '标记已处理'}
              </button>
              <button type="button" className="text-action" onClick={() => void remove(item)}>
                删除
              </button>
            </div>
            {editingId === item.id && (
              <div className="work-materials-process">
                {item.fileId ? (
                  <StoredFileEditor
                    fileId={item.fileId}
                    fileName={item.fileName}
                    mimeType={item.mimeType}
                    title={item.title}
                    note={item.note}
                    extractedText={item.extractedText}
                    onMeta={(next) => patch(item.id, next)}
                  />
                ) : (
                  <p className="work-materials-hint">这条还没有文件。可在上方上传后添加，或只保留文字记录。</p>
                )}
              </div>
            )}
          </li>
        ))}
        {materials.length === 0 && <li className="work-empty-row">还没有资料。可上传识别，也可以只手填名称。</li>}
      </ul>
    </div>
  )
}
