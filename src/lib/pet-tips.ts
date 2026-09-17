export const PET_TIPS = ['喝水', '活动'] as const

export type PetTip = (typeof PET_TIPS)[number]

export const PET_TIP_INTERVAL_HOURS = 2
export const PET_TIP_START_HOUR = 8
export const PET_TIP_END_HOUR = 22

const SLOT_STORAGE_KEY = 'teacher-workbench-pet-tip-slot'
let claimedSlotKey: string | null = null

export function nextPetTip(previous?: string | null): PetTip {
  const pool = PET_TIPS.filter((tip) => tip !== previous)
  const choices = pool.length > 0 ? pool : [...PET_TIPS]
  return choices[Math.floor(Math.random() * choices.length)] ?? PET_TIPS[0]
}

export function petTipLine(greetingName: string, tip: string = nextPetTip()) {
  const name = greetingName.trim() || '老师'
  return `${name}，该${tip}了`
}

export function hourlyTipSlotKey(at: Date): string {
  return `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}-${at.getHours()}`
}

export function isHourlyTipSlot(at: Date): boolean {
  if (at.getMinutes() !== 0) return false
  const hour = at.getHours()
  if (hour < PET_TIP_START_HOUR || hour > PET_TIP_END_HOUR) return false
  return (hour - PET_TIP_START_HOUR) % PET_TIP_INTERVAL_HOURS === 0
}

export function claimHourlyTipSlot(at: Date = new Date()): boolean {
  if (!isHourlyTipSlot(at)) return false
  const key = hourlyTipSlotKey(at)
  try {
    if (sessionStorage.getItem(SLOT_STORAGE_KEY) === key) return false
    sessionStorage.setItem(SLOT_STORAGE_KEY, key)
  } catch {
    if (claimedSlotKey === key) return false
    claimedSlotKey = key
  }
  return true
}
