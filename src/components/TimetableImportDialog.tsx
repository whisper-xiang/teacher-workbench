import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  applyTimetableSlots,
  previewTimetableSlots,
  readTimetableSource,
  slotWhenLabel,
  type TimetablePreviewRow,
} from '../lib/timetable-import'
import { recognizeTimetableImport } from '../lib/timetable-import-llm'
import { notify } from '../lib/notify'
import { uid } from '../data/store'
import type { Course } from '../data/types'

type Props = {
  open: boolean
  courses: Course[]
  weekNumber: number
  onClose: () => void
  onApply: (courses: Course[]) => void
}

type PreviewState = {
  text: string
  formatLabel: string
  source: 'ai' | 'local'
  rows: TimetablePreviewRow[]
}

export function TimetableImportDialog({ open, courses, weekNumber, onClose, onApply }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [raw, setRaw] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<PreviewState | null>(null)

  useEffect(() => {
    if (!open) {
      setRaw('')
      setFileName('')
      setBusy(false)
      setError('')
      setPreview(null)
      return undefined
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const selected = preview?.rows.filter((row) => row.selected) ?? []

  const recognize = async (source = raw) => {
    const text = source.trim()
    if (!text) {
      setError('请先粘贴课表或选择文件')
      return
    }
    setBusy(true)
    setError('')
    try {
      const parsed = await recognizeTimetableImport(text, courses)
      if (!parsed.slots.length) {
        setError(parsed.text || '没有认出上课格子')
        setPreview(null)
        return
      }
      setPreview({
        text: parsed.text,
        formatLabel: `${parsed.formatLabel}${parsed.source === 'ai' ? ' · AI 识别' : ' · 本机规则'}`,
        source: parsed.source,
        rows: previewTimetableSlots(courses, parsed.slots),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '识别失败')
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  const takeFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const text = await readTimetableSource(file)
      setFileName(file.name)
      setRaw(text)
      setPreview(null)
      await recognize(text)
    } catch (caught) {
      setBusy(false)
      setError(caught instanceof Error ? caught.message : '读不了这个文件')
    }
  }

  const apply = () => {
    if (!selected.length) return
    const result = applyTimetableSlots(
      courses,
      selected.map(({ name, day, section, room }) => ({ name, day, section, room })),
      weekNumber,
      uid,
    )
    onApply(result.courses)
    const parts = [
      result.created ? `新建 ${result.created} 门` : '',
      result.added ? `补了 ${result.added} 格` : '',
      result.skipped ? `跳过 ${result.skipped} 格已有课` : '',
    ].filter(Boolean)
    notify.success(parts.join('，') || '课表没有变化')
    onClose()
  }

  return createPortal(
    <div
      className="courses-modal-backdrop"
      onMouseDown={() => {
        if (!busy) onClose()
      }}
    >
      <form
        className="courses-composer courses-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timetable-import-title"
        onSubmit={(event) => {
          event.preventDefault()
          if (preview) apply()
          else void recognize()
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          if (!preview) void takeFile(event.dataTransfer.files[0])
        }}
      >
        <div>
          <h2 id="timetable-import-title">{preview ? '确认导入格子' : '导入课表'}</h2>
          <p>
            {preview
              ? '不会清空现有课表。同名课程补时段，已经排过的格子会跳过。'
              : '粘贴教务导出、Excel 复制的表格，或上传 csv / txt / json。由 AI 识别格式再抽出格子。'}
          </p>
        </div>

        {preview ? (
          <>
            <span className="courses-import-format">{preview.formatLabel}</span>
            <p className="courses-import-hint">{preview.text}</p>
            <div className="courses-import-list" role="list">
              {preview.rows.map((row) => (
                <label
                  key={row.key}
                  className={`courses-import-row${row.selected ? '' : ' is-off'}`}
                  role="listitem"
                >
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={row.action === 'exists'}
                    onChange={() =>
                      setPreview({
                        ...preview,
                        rows: preview.rows.map((item) =>
                          item.key === row.key ? { ...item, selected: !item.selected } : item,
                        ),
                      })
                    }
                  />
                  <span>
                    <b>{row.name}</b>
                    <span>{slotWhenLabel(row)}</span>
                    {row.occupiedBy ? <span>该格已有「{row.occupiedBy}」</span> : null}
                  </span>
                  <em>
                    {row.action === 'exists' ? '已在课表' : row.action === 'add-session' ? '加到已有课' : '新建'}
                  </em>
                </label>
              ))}
            </div>
            <div className="composer-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => {
                  setPreview(null)
                  setError('')
                }}
              >
                返回修改
              </button>
              <button type="submit" className="primary-action" disabled={!selected.length}>
                写入 {selected.length} 格
              </button>
            </div>
          </>
        ) : (
          <>
            <label>
              课表内容
              <textarea
                required
                autoFocus
                rows={10}
                value={raw}
                disabled={busy}
                onChange={(event) => {
                  setRaw(event.target.value)
                  setError('')
                }}
                placeholder={'周二 5-6节 教育心理学 文科楼205\n周四 7-8节 教育研究方法 教育楼307'}
              />
            </label>
            <div className="courses-import-file">
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".txt,.csv,.tsv,.json,.html,.htm,.xls,.md,text/plain,text/csv,application/json"
                onChange={(event) => {
                  void takeFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <button type="button" className="outline-action" disabled={busy} onClick={() => fileRef.current?.click()}>
                选择文件
              </button>
              <span>{busy ? '正在识别格式…' : fileName || '也可把文件拖到这里'}</span>
            </div>
            {error ? <p className="courses-import-error">{error}</p> : null}
            <div className="composer-actions">
              <button type="button" className="outline-action" disabled={busy} onClick={onClose}>
                取消
              </button>
              <button type="submit" className="primary-action" disabled={busy || !raw.trim()}>
                {busy ? '识别中…' : '识别格式'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>,
    document.body,
  )
}
