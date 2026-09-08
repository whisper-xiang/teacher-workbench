import { useEffect, useMemo, useRef, useState } from 'react'
import { uid } from '../data/store'
import { JOURNAL_KINDS, type JournalKind, type TeacherProfile, type WorkJournalFile, type WorkJournalNote } from '../data/types'
import { confirm } from '../lib/confirm'
import { todayIso } from '../lib/dates'
import { notify } from '../lib/notify'
import { journalMonth, journalStats, journalYear, notesInYear, buildYearJournalHtml } from '../lib/work-journal'
import { deleteResourceFile, formatFileSize, getResourceFile, openStoredFile, putResourceFile } from '../lib/resource-files'

type Props = {
  notes: WorkJournalNote[]
  profile: TeacherProfile
  onChange: (notes: WorkJournalNote[]) => void
}

type Draft = {
  id: string
  date: string
  title: string
  content: string
  kind: JournalKind
  files: WorkJournalFile[]
}

function emptyDraft(): Draft {
  return { id: '', date: todayIso(), title: '', content: '', kind: '教学', files: [] }
}

function JournalThumb({ fileId, fileName }: { fileId: string; fileName: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let current = ''
    let cancelled = false
    void getResourceFile(fileId).then((stored) => {
      if (cancelled || !stored?.type.startsWith('image/')) return
      current = URL.createObjectURL(stored.blob)
      setUrl(current)
    })
    return () => {
      cancelled = true
      if (current) URL.revokeObjectURL(current)
    }
  }, [fileId])
  if (!url) return <span className="journal-file-name">{fileName}</span>
  return <img className="journal-thumb" src={url} alt={fileName} />
}

export function WorkJournalPanel({ notes, profile, onChange }: Props) {
  const currentYear = new Date().getFullYear()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(0)
  const [pending, setPending] = useState<File[]>([])
  const [previewHtml, setPreviewHtml] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLIFrameElement>(null)

  const years = useMemo(() => {
    const set = new Set(notes.map((item) => journalYear(item)))
    set.add(currentYear)
    return [...set].sort((a, b) => b - a)
  }, [notes, currentYear])

  const yearNotes = useMemo(() => notesInYear(notes, year), [notes, year])
  const visible = useMemo(
    () => (month ? yearNotes.filter((item) => journalMonth(item) === month) : yearNotes),
    [yearNotes, month],
  )
  const stats = journalStats(yearNotes)
  const editing = Boolean(draft.id)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim() && !draft.content.trim() && !pending.length && !draft.files.length) {
      notify.warning('写一句今天干了什么，或上传一张截图')
      return
    }
    const extra: WorkJournalFile[] = []
    for (const file of pending) {
      const fileId = uid('jfile')
      try {
        await putResourceFile(fileId, file, file.name)
      } catch (error) {
        notify.error(error instanceof Error ? error.message : '截图保存失败')
        return
      }
      extra.push({
        id: uid('jatt'),
        fileId,
        fileName: file.name,
        mimeType: file.type,
        size: formatFileSize(file.size),
      })
    }
    const note: WorkJournalNote = {
      id: draft.id || uid('note'),
      date: draft.date || todayIso(),
      title: draft.title.trim() || '工作记录',
      content: draft.content.trim(),
      kind: draft.kind,
      files: [...draft.files, ...extra],
      createdAt: notes.find((item) => item.id === draft.id)?.createdAt || new Date().toISOString(),
    }
    onChange(draft.id ? notes.map((item) => (item.id === draft.id ? note : item)) : [note, ...notes])
    setDraft(emptyDraft())
    setPending([])
    if (fileRef.current) fileRef.current.value = ''
    notify.success(`已记下 ${note.date}「${note.title}」`)
  }

  const removeNote = async (note: WorkJournalNote) => {
    try {
      await confirm.delete(`确定删除「${note.title}」？`)
    } catch {
      return
    }
    await Promise.all(note.files.map((file) => deleteResourceFile(file.fileId).catch(() => undefined)))
    onChange(notes.filter((item) => item.id !== note.id))
    if (draft.id === note.id) {
      setDraft(emptyDraft())
      setPending([])
    }
    notify.warning(`已删除：${note.title}`, '已删除')
  }

  const removeFile = async (file: WorkJournalFile) => {
    await deleteResourceFile(file.fileId).catch(() => undefined)
    setDraft({ ...draft, files: draft.files.filter((item) => item.id !== file.id) })
  }

  const openReport = async (download: boolean) => {
    setBusy(true)
    try {
      const html = await buildYearJournalHtml(notes, year, profile)
      if (download) {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${year}年工作量随手记-${profile.name}.html`
        anchor.click()
        URL.revokeObjectURL(url)
        notify.success(`已下载 ${year} 年工作量报告`)
        return
      }
      setPreviewHtml(html)
    } catch {
      notify.error('报告生成失败')
    } finally {
      setBusy(false)
    }
  }

  const printPreview = () => {
    const frame = previewRef.current
    if (!frame?.contentWindow) return
    frame.contentWindow.focus()
    frame.contentWindow.print()
  }

  return (
    <section className="journal-page" aria-label="随手记">
      <div className="courses-heading journal-head">
        <div>
          <p className="section-label">工作台</p>
          <h1>随手记</h1>
          <p>干完就记一笔，截图会跟着日期一起留着；年底可预览全年并生成工作量报告</p>
        </div>
        <div className="journal-head-actions">
          <button type="button" className="outline-action" disabled={busy} onClick={() => void openReport(false)}>
            预览全年报告
          </button>
          <button type="button" className="primary-action" disabled={busy} onClick={() => void openReport(true)}>
            生成年度报告
          </button>
        </div>
      </div>

      <div className="week-overview journal-block">

      <form className="journal-composer" onSubmit={save}>
        <div className="journal-composer-row">
          <label>
            日期
            <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
          </label>
          <label>
            类型
            <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as JournalKind })}>
              {JOURNAL_KINDS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="journal-title-field">
            今天干了什么
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="例如：批改教育心理学期中作业"
            />
          </label>
        </div>
        <label>
          补充说明
          <textarea
            rows={3}
            value={draft.content}
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
            placeholder="可写过程、对象、结果。截图上传后会标在这条记录的日期下。"
          />
        </label>
        <div className="journal-files-row">
          <label className="journal-file-picker">
            截图 / 附件
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={(event) => setPending([...pending, ...Array.from(event.target.files ?? [])])}
            />
          </label>
          <div className="journal-pending">
            {draft.files.map((file) => (
              <button type="button" key={file.id} className="journal-chip" onClick={() => void removeFile(file)}>
                {file.fileName} ×
              </button>
            ))}
            {pending.map((file) => (
              <span className="journal-chip" key={`${file.name}-${file.size}`}>
                待保存 {file.name}
              </span>
            ))}
          </div>
          <button className="primary-action" type="submit">
            {editing ? '保存修改' : '记下'}
          </button>
          {editing && (
            <button
              type="button"
              className="outline-action"
              onClick={() => {
                setDraft(emptyDraft())
                setPending([])
              }}
            >
              取消
            </button>
          )}
        </div>
      </form>

      <div className="journal-toolbar">
        <label>
          年份
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((item) => (
              <option key={item} value={item}>
                {item} 年
              </option>
            ))}
          </select>
        </label>
        <div className="students-course-tabs" role="tablist" aria-label="按月预览">
          <button type="button" className={!month ? 'active' : ''} onClick={() => setMonth(0)}>
            全年
            <small>{stats.count}</small>
          </button>
          {Array.from({ length: 12 }, (_, index) => {
            const value = index + 1
            const count = stats.byMonth[index]
            return (
              <button
                key={value}
                type="button"
                className={month === value ? 'active' : ''}
                onClick={() => setMonth(value)}
              >
                {value} 月
                {count ? <small>{count}</small> : null}
              </button>
            )
          })}
        </div>
      </div>
      <p className="journal-stats">
        {year} 年已记 {stats.count} 条 · {stats.days} 天有记录 · 附件 {stats.files} 份
      </p>

      <ul className="journal-list">
        {visible.map((note) => (
          <li key={note.id}>
            <div className="journal-item-main">
              <span className="resource-type-pill">{note.date}</span>
              <span className="resource-type-pill">{note.kind}</span>
              <div>
                <strong>{note.title}</strong>
                {note.content ? <p>{note.content}</p> : null}
                {note.files.length > 0 && (
                  <div className="journal-thumbs">
                    {note.files.map((file) => (
                      <button
                        type="button"
                        key={file.id}
                        className="journal-thumb-btn"
                        onClick={() => void openStoredFile(file.fileId)}
                      >
                        <JournalThumb fileId={file.fileId} fileName={file.fileName} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="work-materials-actions">
              <button type="button" className="text-action" onClick={() => setDraft({ ...note })}>
                编辑
              </button>
              <button type="button" className="text-action" onClick={() => void removeNote(note)}>
                删除
              </button>
            </div>
          </li>
        ))}
        {visible.length === 0 && <li className="work-empty-row">这一段还没有随手记</li>}
      </ul>
      </div>

      {previewHtml && (
        <div className="courses-modal-backdrop" onMouseDown={() => setPreviewHtml('')}>
          <div className="journal-preview-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="journal-preview-bar">
              <div>
                <p className="section-label">年度预览</p>
                <h2>{year} 年工作量随手记</h2>
              </div>
              <div className="journal-head-actions">
                <button type="button" className="outline-action" onClick={printPreview}>
                  打印 / 存 PDF
                </button>
                <button type="button" className="primary-action" onClick={() => void openReport(true)}>
                  下载 HTML
                </button>
                <button type="button" className="text-action" onClick={() => setPreviewHtml('')}>
                  关闭
                </button>
              </div>
            </div>
            <iframe ref={previewRef} className="journal-preview-frame" title={`${year}年工作量报告`} srcDoc={previewHtml} />
          </div>
        </div>
      )}
    </section>
  )
}
