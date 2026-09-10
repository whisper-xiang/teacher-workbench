import { useEffect, useMemo, useRef, useState } from 'react'
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

const DRAFT_ACCEPT = '.doc,.docx,.pdf,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

type Props = {
  advisees: ThesisAdvisee[]
  events: CalendarEvent[]
  initialId?: string
  onChangeAdvisees: (advisees: ThesisAdvisee[]) => void
  onChangeEvents: (events: CalendarEvent[]) => void
  onOpenSettings: () => void
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

export function PapersPage({ advisees, events, initialId, onChangeAdvisees, onChangeEvents, onOpenSettings }: Props) {
  const [selectedId, setSelectedId] = useState(initialId || advisees[0]?.id || '')
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [remindDate, setRemindDate] = useState(addDaysIso(todayIso(), 7))
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [llmReady, setLlmReady] = useState(hasLlmSettings)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = todayIso()

  useEffect(() => {
    if (initialId && advisees.some((item) => item.id === initialId)) setSelectedId(initialId)
  }, [initialId, advisees])

  useEffect(() => {
    const sync = () => setLlmReady(hasLlmSettings())
    window.addEventListener('teacher-llm-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('teacher-llm-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const selected = advisees.find((item) => item.id === selectedId)
  const draft = selected ? currentDraft(selected) : undefined
  const overdueCount = advisees.filter((item) => isOverdue(item, today)).length
  const header = useMemo(() => {
    if (!advisees.length) return '还没有人'
    if (overdueCount) return `${advisees.length} 人，${overdueCount} 人逾期待看`
    return `${advisees.length} 人`
  }, [advisees.length, overdueCount])

  useEffect(() => {
    if (!selected) {
      setNoteDraft('')
      setRemindDate(addDaysIso(today, 7))
      setPasteOpen(false)
      setPasteText('')
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
    setSelectedId(next.id)
    setName('')
    setTopic('')
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
        const replace =
          last && last.fileName === nextDraft.fileName && last.receivedAt === nextDraft.receivedAt
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
    setSelectedId(advisees.find((item) => item.id !== selected.id)?.id ?? '')
    files.forEach((id) => void deleteResourceFile(id).catch(() => undefined))
    notify.warning(`已移出「${selected.name}」`)
  }

  const olderDrafts = selected ? selected.drafts.slice(0, -1).slice(-4).reverse() : []

  return (
    <section className="papers-page" aria-label="论文指导">
      <aside className="papers-list-pane">
        <div className="papers-list-tools">
          <p className="section-label">日常工作 · 论文指导</p>
          <h1>论文指导</h1>
          <p className="papers-summary">{header}</p>
          <form className="papers-add" onSubmit={addPerson}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="姓名" aria-label="姓名" />
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="题目，可先空着" aria-label="题目" />
            <button type="submit" className="papers-new">
              添加
            </button>
          </form>
        </div>
        <ul className="papers-note-list" role="listbox" aria-label="指导名单">
          {advisees.map((person) => {
            const selectedRow = person.id === selectedId
            const overdue = isOverdue(person, today)
            return (
              <li key={person.id}>
                <button
                  type="button"
                  className={`${selectedRow ? 'is-selected' : ''}${overdue ? ' is-overdue' : ''}`}
                  onClick={() => setSelectedId(person.id)}
                >
                  <strong>{person.name}</strong>
                  <span>
                    {person.topic.trim() || '未定题'} · {person.stage}
                    {person.nextDate ? ` · ${formatDate(person.nextDate)}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {!advisees.length && <p className="papers-empty">还没有人。先添加一个人。</p>}
      </aside>

      <div className="papers-archive">
        {!selected && <p className="papers-empty-main">还没有人。左边添加一个人。</p>}
        {selected && (
          <>
            <div className="papers-block">
              <div className="papers-block-head">
                <h2>人</h2>
                <button type="button" className="text-action" onClick={() => void removePerson()}>
                  移出
                </button>
              </div>
              <label>
                姓名
                <input
                  value={selected.name}
                  onChange={(event) => patchPerson(selected.id, (person) => ({ ...person, name: event.target.value }))}
                />
              </label>
              <label>
                题目
                <input
                  value={selected.topic}
                  onChange={(event) => patchPerson(selected.id, (person) => ({ ...person, topic: event.target.value }))}
                  placeholder="未定题"
                />
              </label>
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

            <div className="papers-block">
              <h2>当前稿</h2>
              <div
                className={`papers-drop${draft ? ' has-file' : ''}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  void takeFile(event.dataTransfer.files[0])
                }}
              >
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
                {draft ? (
                  <div className="papers-draft-now">
                    <button type="button" className="text-action" onClick={() => void openDraft(draft)}>
                      {draft.fileName}
                    </button>
                    <span>
                      {formatDate(draft.receivedAt)}
                      {draft.size ? ` · ${draft.size}` : ''}
                    </span>
                  </div>
                ) : (
                  <p>把 Word 或 PDF 拖到这里</p>
                )}
                <button type="button" className="outline-action" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? '正在收下…' : draft ? '换一版' : '上传这一版'}
                </button>
              </div>
              {olderDrafts.length > 0 && (
                <ul className="papers-old-drafts">
                  {olderDrafts.map((item) => (
                    <li key={item.id}>
                      <span>上一版</span>
                      <button type="button" className="text-action" onClick={() => void openDraft(item)}>
                        {item.fileName}
                      </button>
                      <span>{formatDate(item.receivedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="papers-block">
              <h2>分析这一版</h2>
              <div className="papers-analyze-actions">
                <button
                  type="button"
                  className="primary-action"
                  disabled={analyzing || !draft?.extractedText}
                  title={!draft?.extractedText ? '先上传一份能读出正文的稿' : !llmReady ? '到设置填写模型接口' : '分析当前稿'}
                  onClick={() => void runAnalysis()}
                >
                  {analyzing ? '正在读…' : '分析这一版'}
                </button>
                {!llmReady && (
                  <button type="button" className="text-action" onClick={onOpenSettings}>
                    到设置填写接口
                  </button>
                )}
                {draft?.extractedText && (
                  <button type="button" className="text-action" onClick={() => void copyPrompt()}>
                    复制提示词
                  </button>
                )}
              </div>
              {!draft?.extractedText && <p className="papers-help">有正文后才能分析。文稿只在你点分析时发往设置里的模型。</p>}
              {selected.analysis && (
                <div className="papers-analysis">
                  <p>{selected.analysis.summary}</p>
                  {selected.analysis.findings.map((item, index) => (
                    <article key={`${item.issue}-${index}`}>
                      <strong>{item.issue}</strong>
                      {item.location ? <span>{item.location}</span> : null}
                      {item.say ? <em>{item.say}</em> : null}
                    </article>
                  ))}
                </div>
              )}
              {(pasteOpen || (!llmReady && !selected.analysis)) && draft?.extractedText && (
                <div className="papers-paste">
                  <textarea
                    value={pasteText}
                    onChange={(event) => setPasteText(event.target.value)}
                    rows={4}
                    placeholder="模型回了 JSON，贴在这里"
                  />
                  <button type="button" className="outline-action" onClick={applyPasted}>
                    采用这段结果
                  </button>
                </div>
              )}
            </div>

            <div className="papers-block">
              <h2>意见</h2>
              <textarea
                className="papers-note-input"
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={6}
                placeholder="分析后会出现草稿，也可以自己写"
              />
              <div className="papers-note-actions">
                <button type="button" className="primary-action" onClick={writeNote}>
                  写入指导意见
                </button>
                <label className="papers-remind">
                  下次
                  <input type="date" value={remindDate} onChange={(event) => setRemindDate(event.target.value)} />
                </label>
                <button type="button" className="outline-action" onClick={remindNext}>
                  提醒我下次看
                </button>
              </div>
              {selected.notes.length > 0 && (
                <ol className="papers-notes">
                  {selected.notes.map((item) => (
                    <li key={item.id}>
                      <strong>
                        {formatDate(item.date)} · {item.stage}
                      </strong>
                      <p>{item.text}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
