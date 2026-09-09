import { useEffect, useRef, useState } from 'react'
import type { PetKind } from '../data/types'
import { getResourceFile } from '../lib/resource-files'
import { PET_AVATAR_EVENT } from '../lib/q-pet'
import { petDisplayName, resolvePetKind } from '../lib/pet-kind'
import { PetMascot } from './PetMascots'
import './desk-pet.css'

type Mood = 'idle' | 'walk' | 'talk' | 'celebrate'

type Props = {
  greetingName: string
  pageId?: string
  petAvatarId?: string
  petKind?: PetKind
}

const REFLECT_PROMPT = '吾日三省吾身：喝水、走动、提肛。'

function PetFigure({
  mood,
  facing,
  kind,
  photoUrl,
}: {
  mood: Mood
  facing: 1 | -1
  kind: PetKind
  photoUrl: string | null
}) {
  if (kind === 'photo' && photoUrl) {
    return (
      <img
        className={`desk-pet-photo${mood === 'walk' ? ' is-walking' : ''}`}
        src={photoUrl}
        alt="我的Q版桌宠"
        draggable={false}
      />
    )
  }
  const mascot = kind === 'photo' ? 'ning' : kind
  return <PetMascot kind={mascot} mood={mood} facing={facing} />
}

export function DeskPet({ greetingName, pageId, petAvatarId, petKind }: Props) {
  const kind = resolvePetKind({ petKind, petAvatarId })
  const [pos, setPos] = useState({ x: 24, y: 80 })
  const [facing, setFacing] = useState<1 | -1>(-1)
  const [mood, setMood] = useState<Mood>('idle')
  const [speech, setSpeech] = useState('')
  const [docked, setDocked] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const moved = useRef(false)
  const pauseUntil = useRef(0)
  const dirRef = useRef({ x: -0.7, y: 0.25 })
  const mounted = useRef(false)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    const load = async () => {
      if (kind !== 'photo' || !petAvatarId) {
        setPhotoUrl(null)
        return
      }
      const stored = await getResourceFile(petAvatarId)
      if (cancelled) return
      if (!stored) {
        setPhotoUrl(null)
        return
      }
      url = URL.createObjectURL(stored.blob)
      setPhotoUrl(url)
    }
    const onPetChange = () => void load()
    void load()
    window.addEventListener(PET_AVATAR_EVENT, onPetChange)
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
      window.removeEventListener(PET_AVATAR_EVENT, onPetChange)
    }
  }, [petAvatarId, kind])

  const say = (text: string, next: Mood = 'talk') => {
    setSpeech(text)
    setMood(next)
    pauseUntil.current = Date.now() + 4200
  }

  const remind = () => {
    const name = greetingName || '老师'
    say(`${name}，${REFLECT_PROMPT}`)
  }

  useEffect(() => {
    setPos({
      x: Math.max(24, window.innerWidth - 108),
      y: Math.max(80, window.innerHeight - 168),
    })
  }, [])

  useEffect(() => {
    const first = !mounted.current
    mounted.current = true
    if (!first && pageId !== 'overview') return undefined
    const t = window.setTimeout(remind, first ? 1400 : 400)
    return () => window.clearTimeout(t)
    // 打开应用、以及每次回到概览时提示一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId])

  useEffect(() => {
    if (docked) return undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined
    const tick = window.setInterval(() => {
      if (Date.now() < pauseUntil.current || drag.current) {
        setMood((current) => (current === 'walk' ? 'idle' : current))
        return
      }
      const dir = dirRef.current
      setPos((current) => {
        const minX = 16
        const maxX = Math.max(minX, window.innerWidth - 92)
        const minY = 72
        const maxY = Math.max(minY, window.innerHeight - 148)
        let x = current.x + dir.x * 1.4
        let y = current.y + dir.y * 1.4
        if (x <= minX || x >= maxX) dir.x *= -1
        if (y <= minY || y >= maxY) dir.y *= -1
        x = Math.min(maxX, Math.max(minX, x))
        y = Math.min(maxY, Math.max(minY, y))
        return { x, y }
      })
      setFacing(dir.x >= 0 ? 1 : -1)
      setMood((current) => (current === 'talk' ? current : 'walk'))
    }, 40)
    const pauseWalk = window.setInterval(() => {
      if (drag.current) return
      pauseUntil.current = Date.now() + 2200 + Math.random() * 1800
      setMood('idle')
    }, 7000)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(pauseWalk)
    }
  }, [docked])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (docked) return
      remind()
    }, 4 * 60 * 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetingName, docked])

  useEffect(() => {
    if (mood !== 'talk') return undefined
    const t = window.setTimeout(() => {
      setMood('idle')
      setSpeech('')
    }, 5000)
    return () => window.clearTimeout(t)
  }, [mood])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    moved.current = false
    drag.current = { x: pos.x, y: pos.y, px: event.clientX, py: event.clientY }
    pauseUntil.current = Date.now() + 12_000
    setMood('idle')
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const dx = event.clientX - drag.current.px
    const dy = event.clientY - drag.current.py
    if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true
    setPos({
      x: drag.current.x + dx,
      y: drag.current.y + dy,
    })
  }

  const onPointerUp = () => {
    drag.current = null
  }

  if (docked) {
    return (
      <button
        type="button"
        className={`desk-pet-dock${shaking ? ' is-shaking' : ''}`}
        style={{ left: Math.min(Math.max(12, pos.x), window.innerWidth - 52), top: Math.min(Math.max(72, pos.y + 48), window.innerHeight - 58) }}
        onClick={() => {
          setShaking(true)
          window.setTimeout(() => setShaking(false), 480)
          setDocked(false)
          remind()
        }}
        aria-label={`展开${petDisplayName(kind)}`}
      >
        <PetFigure mood="idle" facing={-1} kind={kind} photoUrl={photoUrl} />
      </button>
    )
  }

  return (
    <div
      className={`desk-pet-stage mood-${mood}`}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {(speech || mood === 'talk') && (
        <div className="desk-pet-bubble" role="status">
          {speech || REFLECT_PROMPT}
        </div>
      )}
      <button
        type="button"
        className={`desk-pet-avatar${shaking ? ' is-shaking' : ''}`}
        onClick={() => {
          if (moved.current) return
          setShaking(true)
          window.setTimeout(() => setShaking(false), 480)
          remind()
        }}
        aria-label={`${petDisplayName(kind)}，点击听三省提示`}
      >
        <PetFigure mood={mood} facing={facing} kind={kind} photoUrl={photoUrl} />
      </button>
      <button type="button" className="desk-pet-mini" onClick={() => setDocked(true)}>
        收起
      </button>
    </div>
  )
}
