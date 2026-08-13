import { useEffect, useRef, useState } from 'react'
import type { Course } from '../data/types'
import { draftSummary, parseAssistantInput, type AssistantDraft } from '../lib/assistant'
import { formatReminderTime } from '../lib/reminder-nlp'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  draft?: AssistantDraft
  committed?: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  courses: Course[]
  onCommit: (draft: AssistantDraft) => string
}

const STARTERS = ['提醒我明天批改作业', '帮我在周三下午加一节教育心理学', '上传一份课堂观察记录到资源库']

export function AiAssistantPanel({ open, onClose, courses, onCommit }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: '你好，我是教学工作台助手。\n\n确认后会写入本机数据：\n· 「明天 8:30 提醒我批改作业」\n· 「周三下午加一节教育心理学」\n· 「把课堂观察记录加到资源库」',
    },
  ])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, thinking])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const send = (text: string) => {
    const content = text.trim()
    if (!content || thinking) return

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: content }
    setMessages((prev) => [...prev, userMsg])
    setDraft('')
    setThinking(true)

    window.setTimeout(() => {
      const parsed = parseAssistantInput(content, courses)
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: parsed.text, draft: parsed.draft },
      ])
      setThinking(false)
    }, 280)
  }

  const confirmDraft = (messageId: string, item: AssistantDraft) => {
    const result = onCommit(item)
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, committed: true, text: `${message.text}\n\n${result}` } : message,
      ),
    )
  }

  if (!open) return null

  return (
    <>
      <button type="button" className="ai-assistant-scrim" aria-label="关闭 AI 助手" onClick={onClose} />
      <aside className="ai-assistant-panel" aria-label="AI 助手">
        <header className="ai-assistant-head">
          <div>
            <strong>AI 助手</strong>
            <span>确认后写入本机</span>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="ai-assistant-body" ref={bodyRef}>
          {messages.map((message) => (
            <article key={message.id} className={`ai-chat-bubble ai-chat-bubble--${message.role}`}>
              {message.text.split('\n').map((line, index) => (
                <p key={`${message.id}-${index}`}>{line || '\u00A0'}</p>
              ))}
              {message.draft && (
                <div className="ai-draft-card">
                  <strong>{draftSummary(message.draft).title}</strong>
                  <small>
                    {message.draft.kind === 'reminder'
                      ? formatReminderTime(message.draft.scheduledAt)
                      : draftSummary(message.draft).meta}
                  </small>
                  {message.committed ? (
                    <em>已写入</em>
                  ) : (
                    <button type="button" className="primary-action" onClick={() => confirmDraft(message.id, message.draft!)}>
                      确认写入
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
          {thinking && (
            <article className="ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--typing">正在整理…</article>
          )}
        </div>

        <div className="ai-assistant-starters">
          {STARTERS.map((item) => (
            <button key={item} type="button" onClick={() => send(item)}>
              {item}
            </button>
          ))}
        </div>

        <footer className="ai-assistant-foot">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="例如：明天上午提醒我批改作业"
            rows={2}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send(draft)
              }
            }}
          />
          <button type="button" className="primary-action" disabled={!draft.trim() || thinking} onClick={() => send(draft)}>
            发送
          </button>
        </footer>
      </aside>
    </>
  )
}
