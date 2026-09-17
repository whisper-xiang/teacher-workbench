import { useEffect, useRef } from 'react'

type Props = {
  text: string
  onDismiss: () => void
}

export function PetTipBubble({ text, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const armed = useRef(false)

  useEffect(() => {
    armed.current = false
    const t = window.setTimeout(() => {
      armed.current = true
      if (ref.current?.matches(':hover')) onDismiss()
    }, 700)
    return () => window.clearTimeout(t)
  }, [text, onDismiss])

  return (
    <div
      ref={ref}
      className="desk-pet-bubble"
      role="status"
      title="移上去即可关闭"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseEnter={() => {
        if (armed.current) onDismiss()
      }}
    >
      {text}
      <span className="desk-pet-bubble-hint">关闭</span>
    </div>
  )
}
