import { useEffect, useRef, useState } from 'react'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type Props = {
  open: boolean
  onClose: () => void
}

const STARTERS = [
  '帮我在周三下午加一节教育心理学',
  '上传一份课堂观察记录到资源库',
  '提醒我明天批改作业',
]

function mockReply(input: string): string {
  const text = input.trim()
  if (/课程|排课|课表/.test(text)) {
    return '（原型）我可以解析你的描述并生成课程草稿，例如：\n· 课程名：教育心理学\n· 时间：周三 第 3–4 节\n· 班级：教育学 2024-1\n\n确认后将写入「课程与排课」，并同步到日程。'
  }
  if (/资源|上传|课件|教案/.test(text)) {
    return '（原型）我可以帮你创建资源索引条目，填入标题、所属课程、类型与标签。正式版将支持选择本地文件并写入「教学资源库」。'
  }
  if (/提醒|通知|备忘/.test(text)) {
    return '（原型）我可以把自然语言转成提醒，例如「明天 8:30 提醒批改作业」，写入「通知提醒」并可选系统通知。'
  }
  if (/任务|看板|待办/.test(text)) {
    return '（原型）我可以把描述转为看板任务，指定课程、截止日与优先级，写入「教学看板」。'
  }
  if (/学生|成绩|花名册/.test(text)) {
    return '（原型）后续可支持查询学生、批量导入花名册或录入过程性评价，数据写入课程与学生档案。'
  }
  return '（原型）我是工作台 AI 助手。你可以用自然语言让我帮你新增课程、资源、提醒、任务等。当前为界面演示，尚未连接真实写入逻辑。'
}

export function AiAssistantPanel({ open, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: '你好，我是教学工作台 AI 助手（原型）。\n\n你可以直接说：\n· 「周三下午加一节教育心理学」\n· 「把课堂观察记录加到资源库」\n· 「明天提醒我批改作业」',
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
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: mockReply(content) },
      ])
      setThinking(false)
    }, 600)
  }

  if (!open) return null

  return (
    <>
      <button type="button" className="ai-assistant-scrim" aria-label="关闭 AI 助手" onClick={onClose} />
      <aside className="ai-assistant-panel" aria-label="AI 助手">
        <header className="ai-assistant-head">
          <div>
            <strong>AI 助手</strong>
            <span>原型 · 对话录入数据</span>
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
            </article>
          ))}
          {thinking && (
            <article className="ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--typing">
              正在思考…
            </article>
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
            placeholder="描述你想新增或修改的内容…"
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
