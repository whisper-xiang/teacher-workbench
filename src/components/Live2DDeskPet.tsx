import { useEffect, useRef } from 'react'
import type { Widget } from 'l2d-widget'
import { useHourlyPetTip } from '../hooks/useHourlyPetTip'
import { PetTipBubble } from './PetTipBubble'

type Props = {
  greetingName: string
  variant: 'black' | 'white'
}

export function Live2DDeskPet({ greetingName, variant }: Props) {
  const { speech, dismiss, speak } = useHourlyPetTip(greetingName, true)
  const speakRef = useRef(speak)

  useEffect(() => {
    speakRef.current = speak
  }, [speak])

  useEffect(() => {
    let cancelled = false
    let widget: Widget | null = null
    let layerTimer: ReturnType<typeof setInterval> | undefined
    const canvases: HTMLCanvasElement[] = []
    const onPetClick = () => speakRef.current()
    const compact = window.matchMedia('(max-width: 620px)').matches
    const modelFolder = variant === 'white' ? 'tororo' : 'hijiki'
    void import('l2d-widget').then(({ createWidget }) => {
      if (cancelled) return
      const lowerLayer = () => {
        document.querySelectorAll('body > div').forEach((node) => {
          const el = node as HTMLElement
          if (el.style.zIndex === '9999') el.style.zIndex = '24'
          if (el.style.zIndex === '9998') el.style.zIndex = '23'
        })
        document.querySelectorAll('body > div canvas').forEach((node) => {
          const canvas = node as HTMLCanvasElement
          if (canvases.includes(canvas)) return
          canvases.push(canvas)
          canvas.addEventListener('click', onPetClick)
        })
      }
      widget = createWidget({
        model: {
          path: `${import.meta.env.BASE_URL}live2d/${modelFolder}/model.json`,
          scale: compact ? 0.92 : 1.02,
          offset: [0, compact ? -0.08 : -0.04],
          volume: 0,
          logLevel: 'warn',
          tips: false,
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
      lowerLayer()
      layerTimer = window.setInterval(lowerLayer, 120)
      window.setTimeout(() => {
        if (layerTimer) window.clearInterval(layerTimer)
      }, 2000)
    })

    return () => {
      cancelled = true
      if (layerTimer) window.clearInterval(layerTimer)
      canvases.forEach((canvas) => canvas.removeEventListener('click', onPetClick))
      if (widget) void widget.destroy()
    }
  }, [variant])

  if (!speech) return null
  return (
    <div className="desk-pet-live2d-tip">
      <PetTipBubble text={speech} onDismiss={dismiss} />
    </div>
  )
}
