import { useEffect, useMemo, useRef, useState } from 'react'
import '../papers.css'
import { uid } from '../data/store'
import { THESIS_STAGES, type CalendarEvent, type ThesisAdvisee, type ThesisDraft, type ThesisStage } from '../data/types'
import { confirm } from '../lib/confirm'
import { addDaysIso, todayIso } from '../lib/dates'
import { hasLlmSettings } from '../lib/llm-settings'
import { notify } from '../lib/notify'
import { deleteResourceFile, formatFileSize, openStoredFile, putResourceFile } from '../lib/resource-files'
import { analysisToNote, analyzeThesis, buildThesisPrompt, parseThesisAnalysis } from '../lib/thesis-analyze'
import { dropPaperEvents, upsertPaperDeadline } from '../lib/thesis-events'
import { extractThesisText } from '../lib/thesis-text'
import { NavIcon } from '../nav-icons'

const DRAFT_ACCEPT = '.doc,.docx,.pdf,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

type Props = {
  advisees: ThesisAdvisee[]
  events: CalendarEvent[]
  initialId?: string
  onChangeAdvisees: (advisees: ThesisAdvisee[]) => void
  onChangeEvents: (events: CalendarEvent[]) => void
  onOpenSettings: () => void
  onOpenPerson: (id: string) => void
  onBack: () => void
}

type TimelineItem = {
  id: string
  date: string
  kind: 'draft' | 'note' | 'remind' | 'stage'
  title: string
  body?: string
  draft?: ThesisDraft
  current?: boolean
}

function currentDraft(person: ThesisAdvisee) {
  return person.drafts[person.drafts.length - 1]
}

function isOverdue(person: ThesisAdvisee, today: string) {
  return Boolean(person.nextDate && person.nextDate < today)
}

function formatDate(value?: string) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

function buildTimeline(person: ThesisAdvisee, today: string): TimelineItem[] {
  const lastDraftId = currentDraft(person)?.id
  const items: TimelineItem[] = person.drafts.map((draft) => ({
    id: draft.id,
    date: draft.receivedAt,
    kind: 'draft',
    title: draft.fileName,
    body: draft.size,
    draft,
    current: draft.id === lastDraftId,
  }))
  for (const note of person.notes) {
    items.push({
      id: note.id,
      date: note.date,
      kind: 'note',
      title: `指导意见 · ${note.stage}`,
      body: note.text,
    })
  }
  if (person.stageChangedAt) {
    items.push({
      id: `stage-${person.id}`,
      date: person.stageChangedAt,
      kind: 'stage',
      title: `阶段改为${person.stage}`,
    })
  }
  if (person.nextDate) {
    const overdue = person.nextDate < today
    items.push({
      id: `remind-${person.id}`,
      date: person.nextDate,
      kind: 'remind',
      title: overdue ? '逾期待看' : '下次看',
    })
  }
  return items.sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : a.date < b.date ? 1 : -1))
}

export function PapersPage({
  advisees,
  events,
  initialId,
  onChangeAdvisees,
  onChangeEvents,
  onOpenSettings,
  onOpenPerson,
  onBack,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [remindDate, setRemindDate] = useState(addDaysIso(todayIso(), 7))
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [llmReady, setLlmReady] = useState(hasLlmSettings)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const today = todayIso()

  const selected = initialId ? advisees.find((item) => item.id === initialId) : undefined
  const draft = selected ? currentDraft(selected) : undefined
  const overdueCount = advisees.filter((item) => isOverdue(item, today)).length
  const timeline = useMemo(() => (selected ? buildTimeline(selected, today) : []), [selected, today])
  const summary = advisees.length
    ? overdueCount
      ? `${advisees.length} 人，${overdueCount} 人逾期待看`
      : `${advisees.length} 人`
    : '还没有人'

  useEffect(() => {
    const sync = () => setLlmReady(hasLlmSettings())
    window.addEventListener('teacher-llm-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('teacher-llm-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    if (!adding) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAdding(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [adding])

  useEffect(() => {
    if (!selected) {
      setNoteDraft('')
      setRemindDate(addDaysIso(today, 7))
      setPasteOpen(false)
      setPasteText('')
      setDragging(false)
      dragDepth.current = 0
      return
    }
    setNoteDraft(selected.analysis ? analysisToNote(selected.analysis) : '')
    setRemindDate(selected.nextDate && selected.nextDate >= today ? selected.nextDate : addDaysIso(today, 7))
    setPasteOpen(false)
    setPasteText('')
  }, [selected?.id, selected?.analysis?.createdAt, today])

  const patchPerson = (id: string, updater: (person: ThesisAdvisee) => ThesisAdvisee) => {
    onChangeAdvisees(advisees.map((item) => (item.id === id ? updater(item) : item)))
  }

  const addPerson = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      notify.warning('请填写姓名')
      return
    }
    const next: ThesisAdvisee = {
      id: uid('th'),
      name: name.trim(),
      topic: topic.trim(),
      stage: '选题',
      drafts: [],
      notes: [],
    }
    onChangeAdvisees([next, ...advisees])
    setAdding(false)
    setName('')
    setTopic('')
    onOpenPerson(next.id)
    notify.success(`已添加「${next.name}」`)
  }

  const changeStage = (stage: ThesisStage) => {
    if (!selected || selected.stage === stage) return
    patchPerson(selected.id, (person) => ({ ...person, stage, stageChangedAt: today }))
  }

  const takeFile = async (file: File | undefined) => {
    if (!selected || !file) return
    setBusy(true)
    try {
      const fileId = uid('thfile')
      await putResourceFile(fileId, file, file.name)
      const extractedText = await extractThesisText(file)
      const nextDraft: ThesisDraft = {
        id: uid('thd'),
        fileId,
        fileName: file.name,
        mimeType: file.type,
        size: formatFileSize(file.size),
        receivedAt: today,
        extractedText: extractedText || undefined,
      }
      patchPerson(selected.id, (person) => {
        const last = person.drafts[person.drafts.length - 1]
        const replace = last && last.fileName === nextDraft.fileName && last.receivedAt === nextDraft.receivedAt
        if (replace && last.fileId && last.fileId !== fileId) {
          void deleteResourceFile(last.fileId).catch(() => undefined)
        }
        return {
          ...person,
          drafts: replace ? [...person.drafts.slice(0, -1), nextDraft] : [...person.drafts, nextDraft],
          analysis: undefined,
        }
      })
      if (extractedText) notify.success(`已收下「${file.name}」`)
      else notify.warning('文件已保存，但读不出正文。请另存为 PDF、Word 或纯文本再传')
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '文件保存失败')
    } finally {
      setBusy(false)
    }
  }

  const openDraft = async (item: ThesisDraft) => {
    if (!item.fileId) return
    try {
      await openStoredFile(item.fileId)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '打不开这份稿')
    }
  }

  const runAnalysis = async () => {
    if (!selected || !draft?.extractedText) return
    if (!llmReady) {
      notify.warning('到设置填写模型接口')
      onOpenSettings()
      return
    }
    setAnalyzing(true)
    try {
      const analysis = await analyzeThesis({
        topic: selected.topic,
        stage: selected.stage,
        text: draft.extractedText,
        lastNote: selected.notes[0]?.text,
      })
      patchPerson(selected.id, (person) => ({ ...person, analysis }))
      setNoteDraft(analysisToNote(analysis))
      notify.success('已读完这一版')
    } catch (error) {
      setPasteOpen(true)
      notify.error(error instanceof Error ? error.message : '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  const copyPrompt = async () => {
    if (!selected || !draft?.extractedText) return
    try {
      await navigator.clipboard.writeText(
        buildThesisPrompt({
          topic: selected.topic,
          stage: selected.stage,
          text: draft.extractedText,
          lastNote: selected.notes[0]?.text,
        }),
      )
      notify.success('提示词已复制')
    } catch {
      notify.error('复制失败，请检查浏览器权限')
    }
  }

  const applyPasted = () => {
    if (!selected) return
    try {
      const analysis = parseThesisAnalysis(pasteText)
      patchPerson(selected.id, (person) => ({ ...person, analysis }))
      setNoteDraft(analysisToNote(analysis))
      setPasteOpen(false)
      setPasteText('')
      notify.success('已采用贴回的结果')
    } catch {
      notify.error('贴回的内容不是可用的分析结果')
    }
  }

  const writeNote = () => {
    if (!selected) return
    if (!noteDraft.trim()) {
      notify.warning('请先写下意见')
      return
    }
    const next = {
      id: uid('thn'),
      date: today,
      stage: selected.stage,
      text: noteDraft.trim(),
    }
    patchPerson(selected.id, (person) => ({ ...person, notes: [next, ...person.notes] }))
    notify.success('已写入指导意见')
  }

  const remindNext = () => {
    if (!selected) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(remindDate)) {
      notify.warning('请选择日期')
      return
    }
    onChangeEvents(upsertPaperDeadline(events, { ...selected, nextDate: remindDate }, remindDate))
    patchPerson(selected.id, (person) => ({ ...person, nextDate: remindDate }))
    notify.success(`已记到 ${formatDate(remindDate)} 的日程`)
  }

  const removePerson = async () => {
    if (!selected) return
    try {
      await confirm({
        title: '移出指导',
        message: `移出「${selected.name}」后，稿件和意见会从名单里去掉。`,
        confirmButtonText: '移出',
        confirmButtonClass: 'danger',
      })
    } catch {
      return
    }
    const files = selected.drafts.map((item) => item.fileId).filter((id): id is string => Boolean(id))
    onChangeAdvisees(advisees.filter((item) => item.id !== selected.id))
    onChangeEvents(dropPaperEvents(events, selected.id))
    files.forEach((id) => void deleteResourceFile(id).catch(() => undefined))
    onBack()
    notify.warning(`已移出「${selected.name}」`)
  }

  const onDragEnter = (event: React.DragEvent) => {
    if (![...event.dataTransfer.types].includes('Files')) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  const onDragLeave = (event: React.DragEvent) => {
    if (![...event.dataTransfer.types].includes('Files')) return
    event.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragging(false)
    }
  }

  const onDropFile = (event: React.DragEvent) => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    void takeFile(event.dataTransfer.files[0])
  }

  return (
    <section className="papers-page" aria-label="论文指导">
      {!selected && (
        <>
          <div className="papers-heading">
            <div>
              <h1>论文指导</h1>
              <p>{summary}</p>
            </div>
            <div className="papers-heading-actions">
              <button type="button" className="primary-action" onClick={() => setAdding(true)}>
                添加
              </button>
            </div>
          </div>

          <div className="papers-table-wrap">
            <table className="papers-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>题目</th>
                  <th>阶段</th>
                  <th>当前稿</th>
                  <th>下次看</th>
                </tr>
              </thead>
              <tbody>
                {advisees.map((person) => {
                  const latest = currentDraft(person)
                  const overdue = isOverdue(person, today)
                  return (
                    <tr
                      key={person.id}
                      className={overdue ? 'is-overdue' : undefined}
                      onClick={() => onOpenPerson(person.id)}
                    >
                      <td>
                        <button type="button" className="papers-name-btn" onClick={() => onOpenPerson(person.id)}>
                          <strong>{person.name}</strong>
                          {overdue ? <small>逾期待看</small> : null}
                        </button>
                      </td>
                      <td>{person.topic.trim() || '未定题'}</td>
                      <td>{person.stage}</td>
                      <td>{latest?.fileName || '—'}</td>
                      <td>{person.nextDate ? formatDate(person.nextDate) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!advisees.length && <div className="papers-empty">还没有人。先添加一个人。</div>}
          </div>
        </>
      )}

      {selected && (
        <div
          className={`papers-detail${dragging ? ' is-dragging' : ''}`}
          onDragEnter={onDragEnter}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={onDragLeave}
          onDrop={onDropFile}
        >
          <div className="papers-heading papers-heading-detail">
            <div className="papers-heading-lead">
              <button type="button" className="papers-back" onClick={onBack} aria-label="返回" title="返回">
                <NavIcon name="back" size={18} />
              </button>
              <input
                className="papers-title-input"
                value={selected.name}
                aria-label="姓名"
                onChange={(event) => patchPerson(selected.id, (person) => ({ ...person, name: event.target.value }))}
              />
              <input
                className="papers-topic-input"
                value={selected.topic}
                aria-label="题目"
                placeholder="未定题"
                onChange={(event) => patchPerson(selected.id, (person) => ({ ...person, topic: event.target.value }))}
              />
              <div className="papers-stages" role="group" aria-label="阶段">
                {THESIS_STAGES.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    className={selected.stage === stage ? 'is-on' : ''}
                    onClick={() => changeStage(stage)}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>
            <div className="papers-heading-actions">
              <button type="button" className="text-action" onClick={() => void removePerson()}>
                移出
              </button>
            </div>
          </div>

          <button
            type="button"
            className={`papers-drop${dragging ? ' is-over' : ''}`}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? '正在收下…' : draft ? '换一版，或把文件拖进来' : '把 Word 或 PDF 拖进来'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={DRAFT_ACCEPT}
            hidden
            onChange={(event) => {
              void takeFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />

          {timeline.length ? (
            <ol className="papers-timeline">
              {timeline.map((item) => (
                <li key={item.id} className={`is-${item.kind}${item.current ? ' is-current' : ''}`}>
                  <time dateTime={item.date}>{formatDate(item.date)}</time>
                  {item.kind === 'draft' && item.draft ? (
                    <button type="button" className="text-action" onClick={() => void openDraft(item.draft!)}>
                      {item.current ? '当前稿 · ' : ''}
                      {item.title}
                    </button>
                  ) : (
                    <strong>{item.title}</strong>
                  )}
                  {item.kind === 'note' && item.body ? <p>{item.body}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="papers-help">还没有过程。</p>
          )}

          <div className="papers-composer">
            <textarea
              className="papers-note-input"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              rows={4}
              placeholder="写下意见，或先分析这一版"
            />
            {pasteOpen && (
              <div className="papers-paste">
                <textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  rows={3}
                  placeholder="把模型返回的 JSON 贴在这里"
                />
                <button type="button" className="outline-action" onClick={applyPasted}>
                  采用
                </button>
              </div>
            )}
            <div className="papers-note-actions">
              <button
                type="button"
                className="outline-action"
                disabled={analyzing || !draft?.extractedText}
                title={!draft?.extractedText ? '先上传一份能读出正文的稿' : !llmReady ? '到设置填写模型接口' : '分析当前稿'}
                onClick={() => void runAnalysis()}
              >
                {analyzing ? '正在读…' : '分析'}
              </button>
              {draft?.extractedText && (!llmReady || pasteOpen) && (
                <>
                  <button type="button" className="text-action" onClick={() => void copyPrompt()}>
                    复制提示词
                  </button>
                  <button type="button" className="text-action" onClick={() => setPasteOpen((open) => !open)}>
                    {pasteOpen ? '收起贴回' : '贴回结果'}
                  </button>
                </>
              )}
              <button type="button" className="primary-action" onClick={writeNote}>
                写入
              </button>
              <label className="papers-remind">
                下次
                <input type="date" value={remindDate} onChange={(event) => setRemindDate(event.target.value)} />
              </label>
              <button type="button" className="outline-action" onClick={remindNext}>
                提醒我
              </button>
            </div>
          </div>
        </div>
      )}

      {adding && (
        <div className="papers-modal-backdrop" onMouseDown={() => setAdding(false)}>
          <form className="papers-composer-dialog" aria-labelledby="papers-add-title" onSubmit={addPerson} onMouseDown={(event) => event.stopPropagation()}>
            <div className="papers-composer-head">
              <h2 id="papers-add-title">添加</h2>
              <button type="button" className="papers-composer-close" onClick={() => setAdding(false)} aria-label="关闭">
                ×
              </button>
            </div>
            <label>
              姓名
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="姓名" autoFocus />
            </label>
            <label>
              题目
              <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="可先空着" />
            </label>
            <div className="papers-note-actions">
              <button type="button" className="outline-action" onClick={() => setAdding(false)}>
                取消
              </button>
              <button type="submit" className="primary-action">
                添加
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
