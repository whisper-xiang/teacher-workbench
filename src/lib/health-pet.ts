import { todayIso } from './dates'

export const HEALTH_STORAGE_KEY = 'teacher-workbench-health-v1'
export const HEALTH_EVENT = 'health-pet-change'

export type HealthId = 'water' | 'walk' | 'eyes'

export type HealthGoals = Record<HealthId, number>
export type HealthCounts = Record<HealthId, number>

export type HealthPetState = {
  goals: HealthGoals
  checkin: { date: string } & HealthCounts
}

export const HEALTH_ITEMS: {
  id: HealthId
  label: string
  unit: string
  hint: string
  remind: string[]
  cheer: string[]
}[] = [
  {
    id: 'water',
    label: '喝水',
    unit: '杯',
    hint: '起身接一杯温水',
    remind: ['该喝口水啦，我陪你去接～', '坐了这么久，先润润嗓子吧。', '一杯水，眼睛和脑子都会更清楚。'],
    cheer: ['咕咚咕咚，打卡成功！', '又一杯，我替你竖拇指～', '喝水打卡，我开心得转圈圈！'],
  },
  {
    id: 'walk',
    label: '走动',
    unit: '次',
    hint: '站起来走一走、转转肩',
    remind: ['起来走两步吧，别让椅子把你粘住。', '肩颈该活动了，我在这儿等你回来。', '溜达一圈再坐，作业会写得更顺。'],
    cheer: ['走起来啦！我跟你一起蹦。', '站立打卡，血液也跟着开心。', '这一圈走得漂亮！'],
  },
  {
    id: 'eyes',
    label: '护眼',
    unit: '次',
    hint: '看向远处绿植 20 秒',
    remind: ['看看窗外，眼睛也要放假。', '屏幕先放一放，眨眨眼、望远方。', '20 秒远眺，我帮你计时。'],
    cheer: ['眼睛亮晶晶，打卡完成！', '远眺成功，我给你比心。', '护眼打卡，屏幕也温柔一点。'],
  },
]

export const DEFAULT_GOALS: HealthGoals = { water: 8, walk: 6, eyes: 4 }

function emptyCounts(): HealthCounts {
  return { water: 0, walk: 0, eyes: 0 }
}

export function clampGoal(value: number) {
  return Math.min(20, Math.max(1, Math.round(value) || 1))
}

export function loadHealthPet(): HealthPetState {
  const today = todayIso()
  try {
    const raw = JSON.parse(localStorage.getItem(HEALTH_STORAGE_KEY) || '{}') as Partial<HealthPetState>
    const goals: HealthGoals = {
      water: clampGoal(raw.goals?.water ?? DEFAULT_GOALS.water),
      walk: clampGoal(raw.goals?.walk ?? DEFAULT_GOALS.walk),
      eyes: clampGoal(raw.goals?.eyes ?? DEFAULT_GOALS.eyes),
    }
    const sameDay = raw.checkin?.date === today
    return {
      goals,
      checkin: {
        date: today,
        water: sameDay ? Math.max(0, raw.checkin?.water ?? 0) : 0,
        walk: sameDay ? Math.max(0, raw.checkin?.walk ?? 0) : 0,
        eyes: sameDay ? Math.max(0, raw.checkin?.eyes ?? 0) : 0,
      },
    }
  } catch {
    return { goals: { ...DEFAULT_GOALS }, checkin: { date: today, ...emptyCounts() } }
  }
}

export function saveHealthPet(state: HealthPetState) {
  localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new Event(HEALTH_EVENT))
}

export function punchHealth(id: HealthId): HealthPetState {
  const state = loadHealthPet()
  const cap = state.goals[id]
  if (state.checkin[id] < cap) {
    state.checkin[id] += 1
    saveHealthPet(state)
    window.dispatchEvent(new CustomEvent('health-pet-punch', { detail: id }))
  }
  return state
}

export function undoHealth(id: HealthId): HealthPetState {
  const state = loadHealthPet()
  if (state.checkin[id] > 0) state.checkin[id] -= 1
  saveHealthPet(state)
  return state
}

export function updateHealthGoals(patch: Partial<HealthGoals>): HealthPetState {
  const state = loadHealthPet()
  state.goals = {
    water: clampGoal(patch.water ?? state.goals.water),
    walk: clampGoal(patch.walk ?? state.goals.walk),
    eyes: clampGoal(patch.eyes ?? state.goals.eyes),
  }
  saveHealthPet(state)
  return state
}

export function healthProgress(state: HealthPetState, id: HealthId) {
  const goal = Math.max(1, state.goals[id])
  const count = Math.min(goal, state.checkin[id])
  return { count, goal, done: count >= goal, pct: Math.round((count / goal) * 100) }
}

export function weakestGoal(state: HealthPetState): HealthId | null {
  const pending = HEALTH_ITEMS.map((item) => ({ id: item.id, ...healthProgress(state, item.id) })).filter((item) => !item.done)
  if (!pending.length) return null
  pending.sort((a, b) => a.pct - b.pct)
  return pending[0].id
}

export function pickPhrase(list: string[]) {
  return list[Math.floor(Math.random() * list.length)] ?? list[0]
}
