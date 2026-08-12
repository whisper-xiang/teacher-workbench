import { iso, shift, todayIso } from './dates'
import type { BoardPriority, BoardTask } from '../data/types'

const PRIORITY_CYCLE: BoardPriority[] = ['high', 'medium', 'low']

export function nextPriority(current?: BoardPriority): BoardPriority {
  const index = PRIORITY_CYCLE.indexOf(current ?? 'medium')
  return PRIORITY_CYCLE[(index + 1) % PRIORITY_CYCLE.length]
}

/** Resolve comparable due date for overdue checks. */
export function resolveTaskDueDate(task: Pick<BoardTask, 'due' | 'dueDate'>, today = todayIso()): string | null {
  if (task.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) return task.dueDate

  const text = task.due.trim()
  if (!text || /已提交|已完成|等待|待定/.test(text)) return null
  if (text.includes('今天')) return today
  if (text.includes('明天')) return iso(shift(new Date(`${today}T12:00:00`), 1))

  const isoMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const cnMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (cnMatch) {
    const year = Number(today.slice(0, 4))
    const month = cnMatch[1].padStart(2, '0')
    const day = cnMatch[2].padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const short = text.match(/^(\d{1,2})-(\d{1,2})$/)
  if (short) {
    const year = Number(today.slice(0, 4))
    return `${year}-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}`
  }

  return null
}

export function isTaskOverdue(task: BoardTask, today = todayIso()) {
  if (task.status === 'done') return false
  const dueDate = resolveTaskDueDate(task, today)
  return Boolean(dueDate && dueDate < today)
}
