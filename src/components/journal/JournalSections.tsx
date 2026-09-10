import { useEffect, useState, type KeyboardEvent } from 'react'
import type { WorkJournalFile, WorkJournalNote } from '../../data/types'
import { dueLabel } from '../../lib/dates'
import { getResourceFile, inferResourceFormat } from '../../lib/resource-files'
import { fileTagOf, parseWeChatTranscript } from '../../lib/wechat-transcript'

export type ShownJournalFile = WorkJournalFile & { pending?: boolean }

function snippetOf(note: Pick<WorkJournalNote, 'title' | 'content' | 'contentKind'>) {
  const chat = note.contentKind === 'chat' ? parseWeChatTranscript(note.content, { stored: true }) : null
  if (chat?.length) {
    const speech = chat.find((item) => item.text && !fileTagOf(item.text)) || chat[0]
    const line = speech.text.replace(/\s+/g, ' ')
    return `${speech.sender}${line ? `：${line}` : ''}`.slice(0, 42)
  }
  const text = note.content.trim() || note.title.trim()
  return text ? text.replace(/\s+/g, ' ').slice(0, 42) : '无附加文字'
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
  return url ? <img className="journal-thumb" src={url} alt={fileName} /> : <span className="journal-file-name">{fileName}</span>
}

export function JournalFileCard({ file, onOpen, onRemove }: { file: ShownJournalFile; onOpen: () => void; onRemove: () => void }) {
  const image = (file.mimeType || '').startsWith('image/')
  return (
    <button
      type="button"
      className={image ? 'journal-thumb-btn' : 'journal-file-card'}
      title={file.pending ? '正在加入' : '打开附件，右键可移除'}
      onClick={() => { if (!file.pending) onOpen() }}
      onContextMenu={(event) => { event.preventDefault(); if (!file.pending) onRemove() }}
    >
      {image ? (
        file.fileId ? <JournalThumb fileId={file.fileId} fileName={file.fileName} /> : <span className="journal-file-name">{file.fileName}</span>
      ) : (
        <>
          <span><strong>{file.fileName}</strong><em>{file.pending ? '正在加入' : file.size}</em></span>
          <i className="journal-file-badge">{fileBadge(file.fileName, file.mimeType)}</i>
        </>
      )}
    </button>
  )
}

type JournalListItem = Pick<WorkJournalNote, 'id' | 'date' | 'title' | 'content' | 'kind' | 'files' | 'contentKind'> &
  Partial<Pick<WorkJournalNote, 'createdAt'>>

type SidebarProps = {
  query: string
  year: number
  month: number
  years: number[]
  monthCounts: number[]
  totalCount: number
  notes: JournalListItem[]
  selectedId: string
  onQueryChange: (value: string) => void
  onYearChange: (value: number) => void
  onMonthChange: (value: number) => void
  onNew: () => void
  onOpen: (note: JournalListItem) => void
  onMoveSelection: (delta: number) => void
}

export function JournalSidebar({
  query,
  year,
  month,
  years,
  monthCounts,
  totalCount,
  notes,
  selectedId,
  onQueryChange,
  onYearChange,
  onMonthChange,
  onNew,
  onOpen,
  onMoveSelection,
}: SidebarProps) {
  const handleKeys = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    onMoveSelection(event.key === 'ArrowDown' ? 1 : -1)
  }

  return (
    <aside className="journal-list-pane">
      <div className="journal-list-tools">
        <input className="journal-search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索" aria-label="搜索随手记" />
        <div className="journal-list-filters">
          <select value={year} onChange={(event) => onYearChange(Number(event.target.value))} aria-label="年份">
            {years.map((item) => <option key={item} value={item}>{item} 年</option>)}
          </select>
          <select value={month} onChange={(event) => onMonthChange(Number(event.target.value))} aria-label="月份">
            <option value={0}>全年 {totalCount}</option>
            {monthCounts.map((count, index) => {
              const value = index + 1
              return <option key={value} value={value}>{value} 月{count ? ` ${count}` : ''}</option>
            })}
          </select>
          <button type="button" className="journal-new" onClick={onNew}>新建</button>
        </div>
      </div>
      <ul className="journal-note-list" role="listbox" aria-label="备忘录列表" onKeyDown={handleKeys}>
        {notes.map((note) => {
          const id = note.id || 'new'
          const selected = selectedId === id
          return (
            <li key={id}>
              <button type="button" role="option" aria-selected={selected} className={selected ? 'is-selected' : ''} onClick={() => onOpen(note)}>
                <strong>{note.title.trim() || '新备忘录'}</strong>
                <span><time dateTime={note.date}>{dueLabel(note.date)}</time><em>{note.kind}</em>{snippetOf(note)}</span>
              </button>
            </li>
          )
        })}
        {notes.length === 0 && <li className="journal-list-empty">没有备忘录</li>}
      </ul>
    </aside>
  )
}
