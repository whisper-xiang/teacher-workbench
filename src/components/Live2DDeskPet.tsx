import { useEffect } from 'react'
import type { Widget } from 'l2d-widget'

type Props = {
  greetingName: string
  variant: 'black' | 'white'
}

const REFLECT_PROMPT = '吾日三省吾身：喝水、走动、提肛。'

export function Live2DDeskPet({ greetingName, variant }: Props) {
  useEffect(() => {
    let cancelled = false
    let widget: Widget | null = null
    const compact = window.matchMedia('(max-width: 620px)').matches
    const name = greetingName || '老师'
    const modelFolder = variant === 'white' ? 'tororo' : 'hijiki'
    const petName = variant === 'white' ? 'Tororo' : 'Hijiki'
    void import('l2d-widget').then(({ createWidget }) => {
      if (cancelled) return
      widget = createWidget({
        model: {
          path: `${import.meta.env.BASE_URL}live2d/${modelFolder}/model.json`,
          scale: compact ? 0.92 : 1.02,
          offset: [0, compact ? -0.08 : -0.04],
          volume: 0,
          logLevel: 'warn',
          tips: {
            welcomeMessage: [`${name}，我是${petName}。`, REFLECT_PROMPT],
            messages: [REFLECT_PROMPT, '看远处 20 秒，眼睛也要下课。'],
            duration: 4200,
            interval: 4 * 60 * 1000,
            typing: { speed: 72 },
            offset: { x: compact ? -24 : -34, y: compact ? -54 : -64 },
            style: {
              border: '1px solid rgba(255,255,255,.2)',
              borderRadius: '14px 14px 5px 14px',
              boxShadow: '0 12px 30px rgba(32,45,38,.2), inset 0 1px rgba(255,255,255,.16)',
              backdropFilter: 'blur(14px)',
              fontFamily: 'inherit',
            },
          },
        },
        position: 'bottom-right',
        size: compact ? { width: 172, height: 172 } : { width: 224, height: 224 },
        primaryColor: 'rgba(47, 77, 63, .92)',
        transitionDuration: 420,
        transitionType: 'fade',
        menus: {
          align: 'left',
          items: [
            {
              label: '眠',
              onClick: (current) => current.sleep(),
            },
          ],
          style: { left: '10px', right: 'auto' },
        },
        statusBar: {
          style: {
            background: 'rgba(47, 77, 63, .92)',
            fontFamily: 'inherit',
          },
        },
      })
    })

    return () => {
      cancelled = true
      if (widget) void widget.destroy()
    }
  }, [greetingName, variant])

  return null
}
