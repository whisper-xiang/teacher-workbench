import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import { uid } from '../data/store'
import { JOURNAL_KINDS, type JournalKind, type TeacherProfile, type WorkJournalFile, type WorkJournalNote } from '../data/types'
import { confirm } from '../lib/confirm'
import { dueLabel, todayIso } from '../lib/dates'
import { notify } from '../lib/notify'
import {
  JOURNAL_FILE_ACCEPT,
  collectClipboardFiles,
  isJournalAttachment,
  looksLikeLocalFilePaths,
} from '../lib/journal-files'
import { inferResourceFormat, deleteResourceFile, formatFileSize, getResourceFile, openStoredFile, putResourceFile } from '../lib/resource-files'
import {
  attachLooseFiles,
  bindTranscript,
  clipboardChatText,
  dateFromTranscript,
  fileTagOf,
  formatTranscript,
  parseWeChatTranscript,
  readClipboardChatText,
  titleFromTranscript,
  type TranscriptMessage,
} from '../lib/wechat-transcript'
import { journalMonth, journalStats, journalYear, notesInYear, buildYearJournalHtml } from '../lib/work-journal'

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
  contentKind?: 'chat'
}

type ShownFile = WorkJournalFile & { pending?: boolean }

function emptyDraft(): Draft {
  return { id: '', date: todayIso(), title: '', content: '', kind: '教学', files: [] }
}

function isDraftEmpty(draft: Draft, pending: File[]) {
  return !draft.title.trim() && !draft.content.trim() && !pending.length && !draft.files.length
}

function snippetOf(note: { title: string; content: string; contentKind?: 'chat' }) {
  const chat = note.contentKind === 'chat' ? parseWeChatTranscript(note.content, { stored: true }) : null
  if (chat?.length) {
    const speech = chat.find((item) => item.text && !fileTagOf(item.text)) || chat[0]
    const line = speech.text.replace(/\s+/g, ' ')
    return `${speech.sender}${line ? `：${line}` : ''}`.slice(0, 42)
  }
  const text = note.content.trim() || note.title.trim()
  if (!text) return '无附加文字'
  return text.replace(/\s+/g, ' ').slice(0, 42)
}

function fileBadge(fileName: string, mimeType = '') {
  const kind = inferResourceFormat(fileName, mimeType)
  if (kind === 'DOC') return 'W'
  if (kind === 'PDF') return 'PDF'
  if (kind === 'PPT') return 'P'
  if (kind === 'MP4') return '视频'
  return '文'
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

function JournalFileCard({
  file,
  onOpen,
  onRemove,
}: {
  file: ShownFile
  onOpen: () => void
  onRemove: () => void
}) {
  const image = (file.mimeType || '').startsWith('image/')
  return (
    <button
      type="button"
      className={image ? 'journal-thumb-btn' : 'journal-file-card'}
      title={file.pending ? '正在加入' : '打开附件，右键可移除'}
      onClick={() => {
        if (!file.pending) onOpen()
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        if (!file.pending) onRemove()
      }}
    >
      {image ? (
        file.fileId ? (
          <JournalThumb fileId={file.fileId} fileName={file.fileName} />
        ) : (
          <span className="journal-file-name">{file.fileName}</span>
        )
      ) : (
        <>
          <span>
            <strong>{file.fileName}</strong>
            <em>{file.pending ? '正在加入' : file.size}</em>
          </span>
          <i className="journal-file-badge">{fileBadge(file.fileName, file.mimeType)}</i>
        </>
      )}
    </button>
  )
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
  const [editSource, setEditSource] = useState(false)
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
      existing.contentKind === current.contentKind &&
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
        contentKind: current.contentKind,
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
    setEditSource(false)
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
    setEditSource(false)
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
    const incoming = Array.from(list)
    const next = incoming.filter(isJournalAttachment)
    if (!next.length) {
      if (incoming.length) notify.warning('随手记可加入图片和常见文档')
      return
    }
    if (!draftRef.current) {
      const created = emptyDraft()
      setDraft(created)
      draftRef.current = created
    }
    setPending((current) => {
      const merged = [...current, ...next]
      pendingRef.current = merged
      return merged
    })
    schedulePersist()
  }

  const applyTranscript = (messages: TranscriptMessage[]) => {
    if (!draftRef.current) {
      const created = emptyDraft()
      setDraft(created)
      draftRef.current = created
    }
    const current = draftRef.current
    const existing = current.contentKind === 'chat' ? parseWeChatTranscript(current.content, { stored: true }) : null
    const merged = existing?.length ? [...existing, ...messages] : messages
    const formatted = existing?.length || !current.content.trim()
      ? formatTranscript(merged)
      : `${current.content.trim()}\n\n${formatTranscript(messages)}`
    const keepTitle = current.title.trim() && current.title.trim() !== '新备忘录'
    updateDraft({
      ...current,
      title: keepTitle ? current.title : titleFromTranscript(merged),
      content: formatted,
      date: dateFromTranscript(merged) || current.date,
      contentKind: 'chat',
    })
    setEditSource(false)
  }

  const appendBody = (text: string) => {
    if (!draftRef.current) {
      const created = emptyDraft()
      setDraft(created)
      draftRef.current = created
    }
    const current = draftRef.current
    const next = current.content.trim() ? `${current.content.trim()}\n\n${text}` : text
    updateDraft({ ...current, content: next })
  }

  const ingestPastedChat = (text: string, files: File[]) => {
    const messages = parseWeChatTranscript(text, { hasFiles: files.length > 0 })
    if (messages) {
      applyTranscript(attachLooseFiles(messages, files))
      if (files.length) addFiles(files)
      else if (messages.some((item) => fileTagOf(item.text)?.kind === '文件')) {
        notify.warning('已按聊天记录排好。若文件没带上，请再拖进编辑区或点「添加附件」。')
      }
      return true
    }
    if (text.trim()) {
      appendBody(text.trim())
      if (files.length) addFiles(files)
      return true
    }
    return false
  }

  const handlePaste = (event: ClipboardEvent) => {
    const target = event.target as HTMLElement | null
    const inSearch = Boolean(target?.closest('.journal-search'))
    const files = collectClipboardFiles(event.clipboardData)
    const text = clipboardChatText(event.clipboardData, files)
    if (inSearch && !files.length) return

    if (text || files.length) {
      event.preventDefault()
      if (ingestPastedChat(text, files)) return
      if (files.length) {
        void readClipboardChatText(files).then((rich) => {
          if (rich) ingestPastedChat(rich, files)
          else {
            addFiles(files)
            notify.warning('只粘到了文件，聊天文字微信没放进剪贴板。可先只复制文字，再把文件拖进来。')
          }
        })
        return
      }
    }
    if (looksLikeLocalFilePaths(event.clipboardData.getData('text/plain'))) {
      event.preventDefault()
      notify.warning('微信复制的是本地路径，浏览器读不到文件。请再拖进编辑区，或点「添加附件」选择。')
    }
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
  const chatMessages =
    draft?.contentKind === 'chat' ? parseWeChatTranscript(draft.content, { stored: true }) : null
  const shownFiles: ShownFile[] = draft
    ? [
        ...draft.files,
        ...pending.map((file) => ({
          id: `pending-${file.name}-${file.size}-${file.lastModified}`,
          fileId: '',
          fileName: file.name,
          mimeType: file.type,
          size: formatFileSize(file.size),
          pending: true,
        })),
      ]
    : []
  const bound = chatMessages?.length ? bindTranscript(chatMessages, shownFiles) : null
  const showTranscript = Boolean(bound && !editSource)

  return (
    <section className="journal-page" aria-label="随手记" onPaste={handlePaste}>
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
                  添加附件
                  <input
                    ref={fileRef}
                    type="file"
                    accept={JOURNAL_FILE_ACCEPT}
                    multiple
                    onChange={(event) => {
                      addFiles(event.target.files ?? [])
                      event.target.value = ''
                    }}
                  />
                </label>
                <span className="journal-editor-spacer" />
                {draft.contentKind === 'chat' && (
                  <button type="button" className="text-action" onClick={() => setEditSource((value) => !value)}>
                    {editSource ? '预览记录' : '编辑原文'}
                  </button>
                )}
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
              {showTranscript && bound ? (
                <div className="journal-transcript" aria-label="聊天记录">
                  {bound.rows.map(({ message, file }, index) => (
                    <article className="journal-msg" key={`${message.sender}-${message.time}-${index}`}>
                      {message.sender && <p className="journal-msg-name">{message.sender}</p>}
                      {message.time && <p className="journal-msg-time">{message.time}</p>}
                      {message.text && <p className="journal-msg-text">{message.text}</p>}
                      {file && (
                        <JournalFileCard
                          file={file}
                          onOpen={() => void openStoredFile(file.fileId)}
                          onRemove={() => {
                            if (!file.pending) void removeFile(file)
                          }}
                        />
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <textarea
                  className="journal-body-input"
                  value={draft.content}
                  onChange={(event) => updateDraft({ ...draft, content: event.target.value })}
                  placeholder="开始记录，可粘贴微信聊天、图片或文档"
                />
              )}
              {((showTranscript && bound?.leftover.length) || (!showTranscript && shownFiles.length > 0)) && (
                <div className="journal-thumbs">
                  {(showTranscript ? bound?.leftover ?? [] : shownFiles).map((file) =>
                    file.pending ? (
                      <span className="journal-chip" key={file.id}>
                        正在加入 {file.fileName}
                      </span>
                    ) : (
                      <JournalFileCard
                        key={file.id}
                        file={file}
                        onOpen={() => void openStoredFile(file.fileId)}
                        onRemove={() => void removeFile(file)}
                      />
                    ),
                  )}
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
