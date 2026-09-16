import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { uid } from '../../data/store'
import type { Course, GradeItem, StudentRecord } from '../../data/types'
import { notify } from '../../lib/notify'
import {
  applyRosterImport,
  previewRosterRows,
  readRosterSource,
  type RosterPreviewRow,
} from '../../lib/roster-import'
import { recognizeRosterImport } from '../../lib/roster-import-llm'

type Props = {
  open: boolean
  course?: Course
  roster: StudentRecord[]
  students: StudentRecord[]
  grades: GradeItem[]
  onClose: () => void
  onApply: (next: { students: StudentRecord[]; grades: GradeItem[] }) => void
}

type PreviewState = {
  text: string
  formatLabel: string
  source: 'ai' | 'local'
  rows: RosterPreviewRow[]
}

export function RosterImportDialog({ open, course, roster, students, grades, onClose, onApply }: Props) {
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

  if (!open || !course) return null

  const selected = preview?.rows.filter((row) => row.selected) ?? []

  const recognize = async (source = raw) => {
    const text = source.trim()
    if (!text) {
      setError('请先粘贴名单或选择文件')
      return
    }
    setBusy(true)
    setError('')
    try {
      const parsed = await recognizeRosterImport(
        text,
        course.id,
        roster.map((item) => `${item.name}${item.number ? ` ${item.number}` : ''}`),
      )
      if (!parsed.students.length) {
        setError(parsed.text || '没有认出学生')
        setPreview(null)
        return
      }
      setPreview({
        text: parsed.text,
        formatLabel: `${parsed.formatLabel}${parsed.source === 'ai' ? ' · AI 识别' : ' · 本机规则'}`,
        source: parsed.source,
        rows: previewRosterRows(roster, parsed.students),
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
      const text = await readRosterSource(file)
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
    const result = applyRosterImport({
      course,
      students,
      grades,
      rows: selected.map(({ name, number, usual, midterm, final }) => ({ name, number, usual, midterm, final })),
      uid,
    })
    onApply({ students: result.students, grades: result.grades })
    const parts = [
      result.created ? `加入 ${result.created} 人` : '',
      result.graded ? `写入 ${result.graded} 人成绩` : '',
      result.skipped ? `跳过 ${result.skipped} 人已在册` : '',
    ].filter(Boolean)
    notify.success(parts.join('，') || '花名册没有变化')
    onClose()
  }

  return createPortal(
    <div
      className="students-modal-backdrop"
      onMouseDown={() => {
        if (!busy) onClose()
      }}
    >
      <form
        className="students-composer students-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="roster-import-title"
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
        <div className="students-composer-head">
          <div>
            <p className="section-label">导入花名册</p>
            <h2 id="roster-import-title">{preview ? '确认写入名单' : '识别名单'}</h2>
            <p className="students-composer-meta">
              {preview
                ? `${course.name} · 已在册的人会跳过`
                : '粘贴教务表、Excel 复制的格子，或上传 csv / txt / json。规则能认的直接抽出，认不出的交给 AI。'}
            </p>
          </div>
          <button type="button" className="students-composer-close" disabled={busy} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        {preview ? (
          <>
            <div className="students-composer-body">
              <span className="students-import-format">{preview.formatLabel}</span>
              <p className="students-import-hint">{preview.text}</p>
              <div className="students-import-list" role="list">
                {preview.rows.map((row) => (
                  <label
                    key={row.key}
                    className={`students-import-row${row.selected ? '' : ' is-off'}`}
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
                      <span>
                        {row.number || '无学号'}
                        {row.usual != null || row.midterm != null || row.final != null
                          ? ` · 平时 ${row.usual ?? '—'} / 期中 ${row.midterm ?? '—'} / 期末 ${row.final ?? '—'}`
                          : ''}
                      </span>
                    </span>
                    <em>{row.action === 'exists' ? '已在册' : '写入'}</em>
                  </label>
                ))}
              </div>
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
                写入 {selected.length} 人
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="students-composer-body">
              <label>
                名单内容
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
                  placeholder={'姓名,学号\n陈思雨,202401020113\n\n或从 Excel 复制整表粘贴'}
                />
              </label>
              <div className="students-import-file">
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
              {error ? <p className="students-import-error">{error}</p> : null}
            </div>
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
