import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Course } from '../data/types'
import {
  draftSummary,
  parseAssistantInput,
  type AssistantDraft,
  type AssistantParse,
} from '../lib/assistant'
import { askAssistant } from '../lib/assistant-llm'
import { NavIcon } from '../nav-icons'

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

const STARTERS = [
  { label: '明天提醒批作业', prompt: '提醒我明天批改作业' },
  { label: '周三安排课程', prompt: '帮我在周三下午加一节教育心理学' },
  { label: '看板加任务', prompt: '看板加一个整理教案的任务' },
]

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: '你好，我是教学工作台助手。可以帮你创建提醒、安排课程和添加任务。\n\n所有更改都会先生成草稿，确认后才会写入本机。课件请到「教学资源库」拖进去。',
}

const MARGIN = 16
const MIN_WIDTH = 360
const MIN_HEIGHT = 520

type PanelFrame = { left: number; top: number; width: number; height: number }

let rememberedFrame: PanelFrame | null = null

function defaultFrame(): PanelFrame {
  const maxWidth = Math.max(280, window.innerWidth - MARGIN * 2)
  const maxHeight = Math.max(320, window.innerHeight - MARGIN * 2)
  const width = Math.min(430, maxWidth)
  const height = Math.min(Math.round(window.innerHeight * 0.88), maxHeight)
  return {
    width,
    height,
    left: Math.max(MARGIN, window.innerWidth - width - 24),
    top: Math.max(MARGIN, window.innerHeight - height - 24),
  }
}

function clampFrame(frame: PanelFrame): PanelFrame {
  const maxWidth = Math.max(280, window.innerWidth - MARGIN * 2)
  const maxHeight = Math.max(320, window.innerHeight - MARGIN * 2)
  const minWidth = Math.min(MIN_WIDTH, maxWidth)
  const minHeight = Math.min(MIN_HEIGHT, maxHeight)
  const width = Math.min(Math.max(minWidth, frame.width), maxWidth)
  const height = Math.min(Math.max(minHeight, frame.height), maxHeight)
  return {
    width,
    height,
    left: Math.min(Math.max(MARGIN, frame.left), Math.max(MARGIN, window.innerWidth - width - MARGIN)),
    top: Math.min(Math.max(MARGIN, frame.top), Math.max(MARGIN, window.innerHeight - height - MARGIN)),
  }
}

export function AiAssistantPanel({ open, onClose, courses, onCommit }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ ...WELCOME }])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [showStarters, setShowStarters] = useState(true)
  const [frame, setFrame] = useState(() => clampFrame(rememberedFrame ?? defaultFrame()))
  const [dragging, setDragging] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef<{ kind: 'move' | 'resize'; pointerId: number; startX: number; startY: number; frame: PanelFrame } | null>(null)

  const applyFrame = (next: PanelFrame) => {
    const clamped = clampFrame(next)
    rememberedFrame = clamped
    setFrame(clamped)
  }

  useEffect(() => {
    if (!open) return
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, thinking])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onResize = () => {
      if (rememberedFrame) {
        const clamped = clampFrame(rememberedFrame)
        rememberedFrame = clamped
        setFrame(clamped)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open, onClose])

  const beginDrag = (kind: 'move' | 'resize', event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault()
    dragRef.current = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      frame,
    }
    setDragging(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* 部分环境没有活动 pointer，仍用 window 监听跟手 */
    }
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      if (drag.kind === 'move') {
        applyFrame({ ...drag.frame, left: drag.frame.left + dx, top: drag.frame.top + dy })
        return
      }
      applyFrame({
        ...drag.frame,
        width: drag.frame.width + dx,
        height: drag.frame.height + dy,
      })
    }
    const onUp = (event: PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
      dragRef.current = null
      setDragging(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging])

  const send = (text: string) => {
    const content = text.trim()
    if (!content || thinking) return

    const history = messages
      .filter((message) => message.id !== 'welcome')
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.text }))

    setDraft('')
    setShowStarters(false)
    setThinking(true)

    void (async () => {
      const userMsg: ChatMessage = { id: `u-${crypto.randomUUID()}`, role: 'user', text: content }
      setMessages((prev) => [...prev, userMsg])
      let parsed: AssistantParse
      try {
        parsed = await askAssistant({ input: content, courses, history })
      } catch (error) {
        const local = parseAssistantInput(content, courses)
        parsed = local.draft
          ? {
              ...local,
              text: `${local.text}\n\n（${error instanceof Error ? error.message : '豆包暂时连不上'}，已按本机规则整理）`,
            }
          : { text: error instanceof Error ? error.message : '豆包暂时连不上，请稍后再试。' }
      }
      setMessages((prev) => [
        ...prev,
        { id: `a-${crypto.randomUUID()}`, role: 'assistant', text: parsed.text, draft: parsed.draft },
      ])
      setThinking(false)
    })()
  }

  const fillStarter = (prompt: string) => {
    setDraft(prompt)
    setShowStarters(false)
    window.requestAnimationFrame(() => {
      const field = inputRef.current
      if (!field) return
      field.focus()
      field.setSelectionRange(prompt.length, prompt.length)
    })
  }

  const startNewChat = () => {
    if (thinking) return
    setMessages([{ ...WELCOME, id: 'welcome' }])
    setDraft('')
    setShowStarters(true)
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
      <aside
        className={`ai-assistant-panel${dragging ? ' is-dragging' : ''}`}
        aria-label="AI 助手"
        style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
      >
        <header
          className="ai-assistant-head"
          title="拖动标题栏移动助手"
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest('.ai-assistant-actions')) return
            beginDrag('move', event)
          }}
        >
          <div className="ai-assistant-identity">
            <span className="ai-assistant-grip" aria-hidden="true" />
            <span className="ai-assistant-mark" aria-hidden="true">AI</span>
            <div className="ai-assistant-title">
              <strong>AI 助手</strong>
              <span>豆包 Mini，内容确认后写入本机</span>
            </div>
          </div>
          <div className="ai-assistant-actions">
            <button
              type="button"
              className="ai-assistant-new"
              onClick={startNewChat}
              disabled={thinking}
              aria-label="新会话"
              title="新会话"
            >
              <NavIcon name="compose" size={16} />
            </button>
            <button type="button" className="ai-assistant-close" onClick={onClose} aria-label="关闭">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        <div className="ai-assistant-body" ref={bodyRef} aria-live="polite">
          {showStarters && (
            <div className="ai-assistant-starters" aria-label="快捷指令">
              <span className="ai-starter-label">试试这样说</span>
              <div className="ai-starter-grid">
                {STARTERS.map((item) => (
                  <button key={item.prompt} type="button" onClick={() => fillStarter(item.prompt)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <article
              key={message.id}
              className={`ai-chat-bubble ai-chat-bubble--${message.role}${message.id === 'welcome' ? ' ai-chat-bubble--welcome' : ''}`}
            >
              {message.text.split('\n').map((line, index) => (
                <p key={`${message.id}-${index}`}>{line || '\u00A0'}</p>
              ))}
              {message.draft && (
                <div className="ai-draft-card">
                  <span className="ai-draft-kicker">待确认操作</span>
                  <strong>{draftSummary(message.draft).title}</strong>
                  <small>
                    {message.draft.kind === 'reminder'
                      ? formatReminderTime(message.draft.scheduledAt)
                      : draftSummary(message.draft).meta}
                  </small>
                  {message.committed ? (
                    <em>已写入本机</em>
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
            <article className="ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--typing" role="status">
              正在整理…
            </article>
          )}
        </div>

        <footer className="ai-assistant-foot">
          <div className="ai-composer-field">
            <label htmlFor="ai-assistant-input">输入指令</label>
            <textarea
              id="ai-assistant-input"
              ref={inputRef}
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
            <small>Enter 发送，Shift + Enter 换行</small>
          </div>
          <button type="button" className="primary-action" disabled={!draft.trim() || thinking} onClick={() => send(draft)}>
            发送
          </button>
        </footer>
        <button
          type="button"
          className="ai-assistant-resize"
          aria-label="拖动调整助手大小"
          onPointerDown={(event) => beginDrag('resize', event)}
        />
      </aside>
    </>
  )
}
