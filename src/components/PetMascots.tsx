import type { PetKind } from '../data/types'

type Mood = 'idle' | 'walk' | 'talk' | 'celebrate'

type Props = {
  kind: Exclude<PetKind, 'photo'>
  mood?: Mood
  facing?: 1 | -1
  className?: string
}

function Shine() {
  return (
    <>
      <circle cx="46" cy="58" r="3" fill="#fff" />
      <circle cx="76" cy="58" r="3" fill="#fff" />
    </>
  )
}

function Eyes({ happy }: { happy: boolean }) {
  if (happy) {
    return (
      <>
        <path d="M38 58c5-6 13-6 17 0" fill="none" stroke="#3d322c" strokeWidth="3" strokeLinecap="round" />
        <path d="M65 58c5-6 13-6 17 0" fill="none" stroke="#3d322c" strokeWidth="3" strokeLinecap="round" />
      </>
    )
  }
  return (
    <>
      <circle cx="46" cy="60" r="8.5" fill="#3d322c" />
      <circle cx="76" cy="60" r="8.5" fill="#3d322c" />
      <Shine />
    </>
  )
}

function Blush() {
  return (
    <>
      <ellipse cx="28" cy="72" rx="11" ry="7" fill="#f4b6b0" opacity="0.75" />
      <ellipse cx="94" cy="72" rx="11" ry="7" fill="#f4b6b0" opacity="0.75" />
      <ellipse cx="46" cy="42" rx="14" ry="8" fill="#fff" opacity="0.4" />
    </>
  )
}

function Mouth({ happy }: { happy: boolean }) {
  return happy ? (
    <path d="M52 78c6 7 12 7 18 0" fill="none" stroke="#c45d4a" strokeWidth="2.6" strokeLinecap="round" />
  ) : (
    <path d="M56 78c4 4 8 4 12 0" fill="none" stroke="#c45d4a" strokeWidth="2.4" strokeLinecap="round" />
  )
}

export function PetMascot({ kind, mood = 'idle', facing = 1, className }: Props) {
  const happy = mood === 'celebrate'
  const walk = mood === 'walk'
  return (
    <svg className={className ?? 'desk-chibi-svg'} viewBox="0 0 122 128" role="img" aria-label="桌面萌宠">
      <ellipse cx="61" cy="121" rx="26" ry="5" fill="#d8cfc0" opacity="0.45" />
      <g className={walk ? 'desk-chibi-body is-walking' : 'desk-chibi-body'} style={{ transform: `scaleX(${facing})`, transformOrigin: '61px 72px' }}>
        {kind === 'ning' && <Ning happy={happy} />}
        {kind === 'hamster' && <Hamster happy={happy} />}
        {kind === 'puppy' && <Puppy happy={happy} />}
        {kind === 'kitty' && <Kitty happy={happy} />}
        {kind === 'bunny' && <Bunny happy={happy} />}
        {kind === 'chick' && <Chick happy={happy} />}
        {kind === 'fox' && <Fox happy={happy} />}
      </g>
    </svg>
  )
}

function Feet(color: string) {
  return (
    <>
      <ellipse className="desk-chibi-leg desk-chibi-leg-l" cx="46" cy="112" rx="12" ry="8" fill={color} />
      <ellipse className="desk-chibi-leg desk-chibi-leg-r" cx="76" cy="112" rx="12" ry="8" fill={color} />
    </>
  )
}

function Ning({ happy }: { happy: boolean }) {
  return (
    <>
      {Feet('#5b4636')}
      <circle cx="61" cy="92" r="30" fill="#3f6b56" />
      <circle cx="61" cy="58" r="46" fill="#f6d7b8" />
      <path d="M22 48c6-24 20-34 39-34s33 10 39 34c-10-8-24-12-39-12s-29 4-39 12Z" fill="#3d322c" />
      <Blush />
      <Eyes happy={happy} />
      <Mouth happy={happy} />
    </>
  )
}

function Hamster({ happy }: { happy: boolean }) {
  return (
    <>
      {Feet('#e8b48a')}
      <circle cx="61" cy="94" r="32" fill="#f3c49a" />
      <circle cx="26" cy="36" r="13" fill="#f3c49a" />
      <circle cx="96" cy="36" r="13" fill="#f3c49a" />
      <circle cx="26" cy="36" r="7" fill="#f7d7c4" />
      <circle cx="96" cy="36" r="7" fill="#f7d7c4" />
      <circle cx="61" cy="58" r="46" fill="#f7d0a8" />
      <ellipse cx="61" cy="74" rx="18" ry="14" fill="#fff6ea" />
      <Blush />
      <Eyes happy={happy} />
      <ellipse cx="61" cy="76" rx="4.5" ry="3.4" fill="#e39a7a" />
      <Mouth happy={happy} />
    </>
  )
}

function Puppy({ happy }: { happy: boolean }) {
  return (
    <>
      {Feet('#c9956a')}
      <circle cx="61" cy="94" r="30" fill="#e8c39a" />
      <ellipse cx="22" cy="56" rx="14" ry="22" transform="rotate(-18 22 56)" fill="#c9956a" />
      <ellipse cx="100" cy="56" rx="14" ry="22" transform="rotate(18 100 56)" fill="#c9956a" />
      <circle cx="61" cy="58" r="46" fill="#f3d2a8" />
      <ellipse cx="61" cy="80" rx="16" ry="12" fill="#fff6ea" />
      <Blush />
      <Eyes happy={happy} />
      <ellipse cx="61" cy="78" rx="7" ry="5" fill="#5b4636" />
      <circle cx="63" cy="76" r="1.5" fill="#fff" />
      <Mouth happy={happy} />
    </>
  )
}

function Kitty({ happy }: { happy: boolean }) {
  return (
    <>
      {Feet('#d9c4b0')}
      <circle cx="61" cy="94" r="30" fill="#e9d5c4" />
      <path d="M22 44 44 10c8 10 10 22 8 32Z" fill="#e9d5c4" />
      <path d="M100 44 78 10c-8 10-10 22-8 32Z" fill="#e9d5c4" />
      <path d="M30 40 44 20c4 8 4 16 2 22Z" fill="#f4b6b0" />
      <path d="M92 40 78 20c-4 8-4 16-2 22Z" fill="#f4b6b0" />
      <circle cx="61" cy="58" r="46" fill="#f0e0d0" />
      <Blush />
      <Eyes happy={happy} />
      <path d="M61 74v8" stroke="#c45d4a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M40 76c8 2 12 2 16 0M66 76c8 2 12 2 16 0" fill="none" stroke="#cbb8a6" strokeWidth="1.6" strokeLinecap="round" />
      <Mouth happy={happy} />
    </>
  )
}

function Bunny({ happy }: { happy: boolean }) {
  return (
    <>
      {Feet('#f3cfd0')}
      <circle cx="61" cy="96" r="28" fill="#fff6f2" />
      <ellipse cx="40" cy="18" rx="11" ry="24" fill="#fff6f2" />
      <ellipse cx="82" cy="18" rx="11" ry="24" fill="#fff6f2" />
      <ellipse cx="40" cy="20" rx="5" ry="14" fill="#f7c4c8" />
      <ellipse cx="82" cy="20" rx="5" ry="14" fill="#f7c4c8" />
      <circle cx="61" cy="60" r="44" fill="#fffaf7" />
      <Blush />
      <Eyes happy={happy} />
      <ellipse cx="61" cy="78" rx="5" ry="3.6" fill="#f0a0a8" />
      <Mouth happy={happy} />
    </>
  )
}

function Chick({ happy }: { happy: boolean }) {
  return (
    <>
      {Feet('#f0a35a')}
      <circle cx="61" cy="94" r="30" fill="#ffe28a" />
      <ellipse cx="28" cy="90" rx="11" ry="8" fill="#ffd56a" />
      <ellipse cx="94" cy="90" rx="11" ry="8" fill="#ffd56a" />
      <circle cx="61" cy="58" r="46" fill="#ffe9a0" />
      <path d="M61 72 52 80h18Z" fill="#f0a35a" />
      <ellipse cx="61" cy="16" rx="8" ry="9" fill="#f0a35a" />
      <Blush />
      <Eyes happy={happy} />
      <Mouth happy={happy} />
    </>
  )
}

function Fox({ happy }: { happy: boolean }) {
  return (
    <>
      {Feet('#e89b5c')}
      <circle cx="61" cy="94" r="30" fill="#f0b27a" />
      <path d="M20 48 42 10c10 12 12 26 8 38Z" fill="#f0b27a" />
      <path d="M102 48 80 10c-10 12-12 26-8 38Z" fill="#f0b27a" />
      <path d="M28 42 42 20c4 8 4 18 2 24Z" fill="#fff6ea" />
      <path d="M94 42 80 20c-4 8-4 18-2 24Z" fill="#fff6ea" />
      <circle cx="61" cy="58" r="46" fill="#f4bc86" />
      <ellipse cx="61" cy="82" rx="18" ry="14" fill="#fff6ea" />
      <Blush />
      <Eyes happy={happy} />
      <ellipse cx="61" cy="78" rx="5" ry="3.8" fill="#5b4636" />
      <Mouth happy={happy} />
    </>
  )
}
