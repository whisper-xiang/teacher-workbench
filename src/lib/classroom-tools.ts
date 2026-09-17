import { calcGradeTotal } from '../data/store'
import { letterGrade, type GradeItem, type StudentRecord } from '../data/types'

export type GradeWeights = {
  usual: number
  midterm: number
  final: number
}

export function shuffled<T>(items: T[]): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = next[index]
    next[index] = next[swap] as T
    next[swap] = current as T
  }
  return next
}

export function splitIntoGroups<T>(items: T[], groupCount: number): T[][] {
  if (!items.length) return []
  const count = Math.max(1, Math.min(Math.floor(groupCount) || 1, items.length))
  const mixed = shuffled(items)
  const groups: T[][] = Array.from({ length: count }, () => [])
  mixed.forEach((item, index) => {
    groups[index % count]?.push(item)
  })
  return groups.filter((group) => group.length > 0)
}

export function splitBySize<T>(items: T[], size: number): T[][] {
  if (!items.length) return []
  const chunk = Math.max(1, Math.floor(size) || 1)
  const mixed = shuffled(items)
  const groups: T[][] = []
  for (let index = 0; index < mixed.length; index += chunk) {
    groups.push(mixed.slice(index, index + chunk))
  }
  return groups
}

export function formatNamedGroups(groups: { name: string }[][]): string {
  return groups
    .map((group, index) => `第${index + 1}组（${group.length}人）\n${group.map((item) => item.name).join('、')}`)
    .join('\n\n')
}

export function suggestedGroupCount(size: number) {
  if (size <= 1) return 1
  if (size <= 4) return 2
  return Math.min(6, Math.max(2, Math.round(size / 4)))
}

export function weightsSum(weights: GradeWeights) {
  return weights.usual + weights.midterm + weights.final
}

export function defaultWeightsFor(grades: { final: number }[]): GradeWeights {
  const hasFinal = grades.some((item) => item.final > 0)
  return hasFinal ? { usual: 30, midterm: 30, final: 40 } : { usual: 50, midterm: 50, final: 0 }
}

export function officialTotal(usual: number, midterm: number, final: number) {
  return calcGradeTotal(usual, midterm, final)
}

export function weightedTotal(usual: number, midterm: number, final: number, weights: GradeWeights) {
  const sum = weightsSum(weights)
  if (sum <= 0) return 0
  return Math.round((usual * weights.usual + midterm * weights.midterm + final * weights.final) / sum)
}

export function scoresOf(student: StudentRecord, grade?: GradeItem) {
  const usual = grade?.usual ?? student.processScore
  const midterm = grade?.midterm ?? 0
  const final = grade?.final ?? 0
  return { usual, midterm, final }
}

export function tallyLetters(totals: number[]) {
  const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  for (const score of totals) {
    const grade = letterGrade(score).grade as keyof typeof counts
    counts[grade] += 1
  }
  return counts
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}
