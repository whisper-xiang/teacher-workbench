import { useEffect, useRef, useState } from 'react'
import type { PetKind } from '../data/types'
import { getResourceFile } from '../lib/resource-files'
import { DEFAULT_Q_PET_SRC, PET_AVATAR_EVENT } from '../lib/q-pet'
import { petDisplayName, resolvePetKind } from '../lib/pet-kind'
import { Live2DDeskPet } from './Live2DDeskPet'
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
  kind: Exclude<PetKind, 'live2d-cat' | 'live2d-white-cat'>
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

export function DeskPet(props: Props) {
  const kind = resolvePetKind(props)
  if (kind === 'live2d-cat' || kind === 'live2d-white-cat') {
    return <Live2DDeskPet greetingName={props.greetingName} variant={kind === 'live2d-white-cat' ? 'white' : 'black'} />
  }
  return <ClassicDeskPet {...props} kind={kind} />
}

function photoCorner() {
  const compact = window.innerWidth <= 860
  return {
    x: Math.max(12, window.innerWidth - (compact ? 96 : 128)),
    y: Math.max(72, window.innerHeight - (compact ? 152 : 204)),
  }
}

function ClassicDeskPet({ greetingName, pageId, petAvatarId, kind }: Props & { kind: Exclude<PetKind, 'live2d-cat' | 'live2d-white-cat'> }) {
  const [pos, setPos] = useState(() =>
    kind === 'photo'
      ? photoCorner()
      : {
          x: Math.max(24, window.innerWidth - 108),
          y: Math.max(80, window.innerHeight - 168),
        },
  )
  const [facing, setFacing] = useState<1 | -1>(-1)
  const [mood, setMood] = useState<Mood>('idle')
  const [speech, setSpeech] = useState('')
  const [docked, setDocked] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(kind === 'photo' ? DEFAULT_Q_PET_SRC : null)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const moved = useRef(false)
  const pinned = useRef(kind === 'photo')
  const pauseUntil = useRef(0)
  const dirRef = useRef({ x: -0.7, y: 0.25 })
  const mounted = useRef(false)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    const load = async () => {
      if (kind !== 'photo') {
        setPhotoUrl(null)
        return
      }
      if (!petAvatarId) {
        setPhotoUrl(DEFAULT_Q_PET_SRC)
        return
      }
      const stored = await getResourceFile(petAvatarId)
      if (cancelled) return
      if (!stored) {
        setPhotoUrl(DEFAULT_Q_PET_SRC)
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
    pinned.current = kind === 'photo'
    if (kind === 'photo') {
      setPos(photoCorner())
      return
    }
    setPos({
      x: Math.max(24, window.innerWidth - 108),
      y: Math.max(80, window.innerHeight - 168),
    })
  }, [kind])

  useEffect(() => {
    const onResize = () => {
      if (kind === 'photo' && pinned.current && !drag.current) {
        setPos(photoCorner())
        return
      }
      setPos((current) => ({
        x: Math.min(Math.max(16, current.x), Math.max(16, window.innerWidth - 92)),
        y: Math.min(Math.max(72, current.y), Math.max(72, window.innerHeight - 148)),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [kind])

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
    if (docked || kind === 'photo') return undefined
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
  }, [docked, kind])

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
    const rect = event.currentTarget.getBoundingClientRect()
    drag.current = { x: rect.left, y: rect.top, px: event.clientX, py: event.clientY }
    setPos({ x: rect.left, y: rect.top })
    pauseUntil.current = Date.now() + 12_000
    setMood('idle')
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const dx = event.clientX - drag.current.px
    const dy = event.clientY - drag.current.py
    if (Math.abs(dx) + Math.abs(dy) > 6) {
      moved.current = true
      pinned.current = false
    }
    setPos({
      x: drag.current.x + dx,
      y: drag.current.y + dy,
    })
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const cornered = kind === 'photo' && pinned.current

  if (docked) {
    return (
      <button
        type="button"
        className={`desk-pet-dock${kind === 'photo' ? ' kind-photo' : ''}${shaking ? ' is-shaking' : ''}`}
        style={
          cornered
            ? { right: 16, bottom: 16, left: 'auto', top: 'auto' }
            : {
                left: Math.min(Math.max(12, pos.x), window.innerWidth - (kind === 'photo' ? 64 : 52)),
                top: Math.min(Math.max(72, pos.y + 48), window.innerHeight - (kind === 'photo' ? 88 : 58)),
              }
        }
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
      className={`desk-pet-stage mood-${mood}${kind === 'photo' ? ' kind-photo' : ''}`}
      style={cornered ? { right: 16, bottom: 12, left: 'auto', top: 'auto' } : { left: pos.x, top: pos.y }}
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
