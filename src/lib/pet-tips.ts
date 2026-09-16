export const PET_TIPS = ['喝水', '走动', '提肛'] as const

export type PetTip = (typeof PET_TIPS)[number]

export function nextPetTip(previous?: string | null): PetTip {
  const pool = PET_TIPS.filter((tip) => tip !== previous)
  const choices = pool.length > 0 ? pool : [...PET_TIPS]
  return choices[Math.floor(Math.random() * choices.length)] ?? PET_TIPS[0]
}

export function petTipLine(greetingName: string, tip: string = nextPetTip()) {
  const name = greetingName.trim() || '老师'
  return `${name}，${tip}`
}

export function shuffledPetTipLines(greetingName: string) {
  const lines = PET_TIPS.map((tip) => petTipLine(greetingName, tip))
  for (let i = lines.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = lines[i]
    const swap = lines[j]
    if (current === undefined || swap === undefined) continue
    lines[i] = swap
    lines[j] = current
  }
  return lines
}
