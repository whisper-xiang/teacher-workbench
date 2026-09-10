import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import '../journal.css'
import {
  JournalFileCard,
  JournalSidebar,
  type ShownJournalFile,
} from '../components/journal/JournalSections'
import { uid } from '../data/store'
import { JOURNAL_KINDS, type JournalKind, type WorkJournalFile, type WorkJournalNote } from '../data/types'
import { confirm } from '../lib/confirm'
import { todayIso } from '../lib/dates'
import { notify } from '../lib/notify'
import {
  JOURNAL_FILE_ACCEPT,
  collectClipboardFiles,
  isJournalAttachment,
  looksLikeLocalFilePaths,
} from '../lib/journal-files'
import { deleteResourceFile, formatFileSize, openStoredFile, putResourceFile } from '../lib/resource-files'
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
import { journalMonth, journalStats, journalYear, notesInYear } from '../lib/work-journal'

type Props = {
  notes: WorkJournalNote[]
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

function emptyDraft(): Draft {
  return { id: '', date: todayIso(), title: '', content: '', kind: '教学', files: [] }
}

function isDraftEmpty(draft: Draft, pending: File[]) {
  return !draft.title.trim() && !draft.content.trim() && !pending.length && !draft.files.length
}

export function WorkJournalPanel({ notes, onChange }: Props) {
  const currentYear = new Date().getFullYear()
  const [draft, setDraft] = useState<Draft | null>(() => {
    const first = notesInYear(notes, currentYear)[0]
    return first ? { ...first } : null
  })
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(0)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<File[]>([])
  const [editSource, setEditSource] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef(draft)
  const pendingRef = useRef(pending)
  const notesRef = useRef(notes)
  const persistTimer = useRef(0)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

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

  const moveSelection = (delta: number) => {
    const index = listNotes.findIndex((item) => (draft?.id ? item.id === draft.id : !item.id))
    const next = listNotes[index + delta]
    if (next) void openNote(next)
  }

  const selectedId = draft?.id ?? (draft ? 'new' : '')
  const chatMessages =
    draft?.contentKind === 'chat' ? parseWeChatTranscript(draft.content, { stored: true }) : null
  const shownFiles: ShownJournalFile[] = draft
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
      <JournalSidebar
        query={query}
        year={year}
        month={month}
        years={years}
        monthCounts={stats.byMonth}
        totalCount={stats.count}
        notes={listNotes}
        selectedId={selectedId}
        onQueryChange={setQuery}
        onYearChange={setYear}
        onMonthChange={setMonth}
        onNew={() => void openNew()}
        onOpen={(note) => void openNote(note)}
        onMoveSelection={moveSelection}
      />

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
                <button type="button" className="text-action is-danger" onClick={() => void removeCurrent()}>
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
    </section>
  )
}
