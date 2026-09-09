import { useEffect, useMemo, useRef, useState } from 'react'
import { uid } from '../data/store'
import { JOURNAL_KINDS, type JournalKind, type TeacherProfile, type WorkJournalFile, type WorkJournalNote } from '../data/types'
import { confirm } from '../lib/confirm'
import { dueLabel, todayIso } from '../lib/dates'
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

function isDraftEmpty(draft: Draft, pending: File[]) {
  return !draft.title.trim() && !draft.content.trim() && !pending.length && !draft.files.length
}

function snippetOf(note: { title: string; content: string }) {
  const text = note.content.trim() || note.title.trim()
  if (!text) return '无附加文字'
  return text.replace(/\s+/g, ' ').slice(0, 42)
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
  const [draft, setDraft] = useState<Draft | null>(() => {
    const first = notesInYear(notes, currentYear)[0]
    return first ? { ...first } : null
  })
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(0)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<File[]>([])
  const [previewHtml, setPreviewHtml] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLIFrameElement>(null)
  const draftRef = useRef(draft)
  const pendingRef = useRef(pending)
  const notesRef = useRef(notes)
  const persistTimer = useRef(0)

  draftRef.current = draft
  pendingRef.current = pending
  notesRef.current = notes

  const years = useMemo(() => {
    const set = new Set(notes.map((item) => journalYear(item)))
    set.add(currentYear)
    return [...set].sort((a, b) => b - a)
  }, [notes, currentYear])

  const yearNotes = useMemo(() => notesInYear(notes, year), [notes, year])
  const monthNotes = useMemo(
    () => (month ? yearNotes.filter((item) => journalMonth(item) === month) : yearNotes),
    [yearNotes, month],
  )
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return monthNotes
    return monthNotes.filter((item) => `${item.title} ${item.content} ${item.kind}`.toLowerCase().includes(q))
  }, [monthNotes, query])
  const stats = journalStats(yearNotes)

  const listNotes = useMemo(() => {
    if (draft && !draft.id) return [draft, ...visible]
    return visible
  }, [visible, draft])

  useEffect(() => {
    setDraft((prev) => {
      if (prev && !prev.id) return prev
      if (prev?.id && monthNotes.some((item) => item.id === prev.id)) return prev
      const first = monthNotes[0]
      return first ? { ...first } : null
    })
  }, [year, month, monthNotes])

  const persist = async (current: Draft | null) => {
    if (!current) return
    const filesToUpload = pendingRef.current
    if (isDraftEmpty(current, filesToUpload) && !current.id) return

    const existing = notesRef.current.find((item) => item.id === current.id)
    if (
      existing &&
      !filesToUpload.length &&
      existing.title === current.title &&
      existing.content === current.content &&
      existing.date === current.date &&
      existing.kind === current.kind &&
      existing.files === current.files
    ) {
      return
    }

    try {
      const extra: WorkJournalFile[] = []
      for (const file of filesToUpload) {
        const fileId = uid('jfile')
        await putResourceFile(fileId, file, file.name)
        extra.push({
          id: uid('jatt'),
          fileId,
          fileName: file.name,
          mimeType: file.type,
          size: formatFileSize(file.size),
        })
      }
      const files = [...current.files, ...extra]
      const note: WorkJournalNote = {
        id: current.id || uid('note'),
        date: current.date || todayIso(),
        title: current.title.trim() || '新备忘录',
        content: current.content.trim(),
        kind: current.kind,
        files,
        createdAt: existing?.createdAt || new Date().toISOString(),
      }
      onChange(
        current.id
          ? notesRef.current.map((item) => (item.id === current.id ? note : item))
          : [note, ...notesRef.current],
      )
      setDraft((prev) => {
        if (!prev) return prev
        if (prev.id && prev.id !== note.id) return prev
        return { ...prev, id: note.id, files }
      })
      setPending((prev) => prev.filter((file) => !filesToUpload.includes(file)))
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '截图保存失败')
    }
  }

  const schedulePersist = () => {
    window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      void persist(draftRef.current)
    }, 400)
  }

  useEffect(() => () => window.clearTimeout(persistTimer.current), [])

  const flushPersist = async () => {
    window.clearTimeout(persistTimer.current)
    await persist(draftRef.current)
  }

  const updateDraft = (next: Draft) => {
    setDraft(next)
    draftRef.current = next
    schedulePersist()
  }

  const openNew = async () => {
    await flushPersist()
    const current = draftRef.current
    if (current && !current.id && isDraftEmpty(current, pendingRef.current)) {
      titleRef.current?.focus()
      return
    }
    setPending([])
    if (fileRef.current) fileRef.current.value = ''
    const next = emptyDraft()
    setDraft(next)
    draftRef.current = next
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  const openNote = async (note: Draft | WorkJournalNote) => {
    const current = draftRef.current
    if (current && (current.id === note.id || (!current.id && !note.id))) return
    if (current && !current.id && isDraftEmpty(current, pendingRef.current)) {
      setPending([])
    } else {
      await flushPersist()
    }
    setPending([])
    if (fileRef.current) fileRef.current.value = ''
    const next = { ...note }
    setDraft(next)
    draftRef.current = next
  }

  const removeCurrent = async () => {
    const current = draftRef.current
    if (!current) return
    const label = current.title.trim() || '新备忘录'
    try {
      await confirm.delete(`确定删除「${label}」？`)
    } catch {
      return
    }
    window.clearTimeout(persistTimer.current)
    await Promise.all(current.files.map((file) => deleteResourceFile(file.fileId).catch(() => undefined)))
    onChange(notesRef.current.filter((item) => item.id !== current.id))
    setPending([])
    const rest = notesRef.current.filter((item) => item.id !== current.id)
    const nextVisible = month
      ? rest.filter((item) => journalYear(item) === year && journalMonth(item) === month)
      : rest.filter((item) => journalYear(item) === year)
    const next = nextVisible[0]
    setDraft(next ? { ...next } : null)
    notify.warning(`已删除：${label}`, '已删除')
  }

  const removeFile = async (file: WorkJournalFile) => {
    if (!draft) return
    await deleteResourceFile(file.fileId).catch(() => undefined)
    updateDraft({ ...draft, files: draft.files.filter((item) => item.id !== file.id) })
  }

  const addFiles = (list: FileList | File[]) => {
    const next = Array.from(list).filter((file) => file.type.startsWith('image/') || file.type === 'application/pdf')
    if (!next.length) return
    setPending((current) => {
      const merged = [...current, ...next]
      pendingRef.current = merged
      return merged
    })
    schedulePersist()
  }

  const openReport = async (download: boolean) => {
    await flushPersist()
    setBusy(true)
    try {
      const html = await buildYearJournalHtml(notesRef.current, year, profile)
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

  const moveSelection = (delta: number) => {
    const index = listNotes.findIndex((item) => (draft?.id ? item.id === draft.id : !item.id))
    const next = listNotes[index + delta]
    if (next) void openNote(next)
  }

  const selectedId = draft?.id ?? (draft ? 'new' : '')

  return (
    <section className="journal-page" aria-label="随手记">
      <div className="journal-head">
        <h1>随手记</h1>
        <div className="journal-head-actions">
          <button type="button" className="outline-action" disabled={busy} onClick={() => void openReport(false)}>
            预览全年
          </button>
          <button type="button" className="primary-action" disabled={busy} onClick={() => void openReport(true)}>
            年度报告
          </button>
        </div>
      </div>

      <div className="journal-split">
        <aside className="journal-list-pane">
          <div className="journal-list-tools">
            <input
              className="journal-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索"
              aria-label="搜索随手记"
            />
            <div className="journal-list-filters">
              <select value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="年份">
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item} 年
                  </option>
                ))}
              </select>
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))} aria-label="月份">
                <option value={0}>全年 {stats.count}</option>
                {Array.from({ length: 12 }, (_, index) => {
                  const value = index + 1
                  const count = stats.byMonth[index]
                  return (
                    <option key={value} value={value}>
                      {value} 月{count ? ` ${count}` : ''}
                    </option>
                  )
                })}
              </select>
              <button type="button" className="journal-new" onClick={() => void openNew()}>
                新建
              </button>
            </div>
          </div>
          <ul
            className="journal-note-list"
            role="listbox"
            aria-label="备忘录列表"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                moveSelection(1)
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                moveSelection(-1)
              }
            }}
          >
            {listNotes.map((note) => {
              const id = note.id || 'new'
              const selected = selectedId === id
              return (
                <li key={id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={selected ? 'is-selected' : ''}
                    onClick={() => void openNote(note)}
                  >
                    <strong>{note.title.trim() || '新备忘录'}</strong>
                    <span>
                      <time dateTime={note.date}>{dueLabel(note.date)}</time>
                      <em>{note.kind}</em>
                      {snippetOf(note)}
                    </span>
                  </button>
                </li>
              )
            })}
            {listNotes.length === 0 && <li className="journal-list-empty">没有备忘录</li>}
          </ul>
        </aside>

        <div className="journal-editor-pane">
          {draft ? (
            <form
              className="journal-editor"
              onSubmit={(event) => event.preventDefault()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                addFiles(event.dataTransfer.files)
              }}
            >
              <div className="journal-editor-bar">
                <label>
                  <span className="sr-only">日期</span>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) => updateDraft({ ...draft, date: event.target.value })}
                  />
                </label>
                <label>
                  <span className="sr-only">类型</span>
                  <select
                    value={draft.kind}
                    onChange={(event) => updateDraft({ ...draft, kind: event.target.value as JournalKind })}
                  >
                    {JOURNAL_KINDS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="journal-attach">
                  添加照片
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={(event) => {
                      addFiles(event.target.files ?? [])
                      event.target.value = ''
                    }}
                  />
                </label>
                <span className="journal-editor-spacer" />
                <button type="button" className="text-action" onClick={() => void removeCurrent()}>
                  删除
                </button>
              </div>
              <input
                ref={titleRef}
                className="journal-title-input"
                value={draft.title}
                onChange={(event) => updateDraft({ ...draft, title: event.target.value })}
                placeholder="标题"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault()
                }}
              />
              <textarea
                className="journal-body-input"
                value={draft.content}
                onChange={(event) => updateDraft({ ...draft, content: event.target.value })}
                placeholder="开始记录"
              />
              {(draft.files.length > 0 || pending.length > 0) && (
                <div className="journal-thumbs">
                  {draft.files.map((file) => (
                    <button
                      type="button"
                      key={file.id}
                      className="journal-thumb-btn"
                      title="打开附件，右键可移除"
                      onClick={() => void openStoredFile(file.fileId)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        void removeFile(file)
                      }}
                    >
                      <JournalThumb fileId={file.fileId} fileName={file.fileName} />
                    </button>
                  ))}
                  {pending.map((file) => (
                    <span className="journal-chip" key={`${file.name}-${file.size}`}>
                      正在加入 {file.name}
                    </span>
                  ))}
                </div>
              )}
            </form>
          ) : (
            <div className="journal-editor-empty">
              <p>从左侧选择一条，或点新建开始写</p>
              <button type="button" className="journal-new" onClick={() => void openNew()}>
                新建备忘录
              </button>
            </div>
          )}
        </div>
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
