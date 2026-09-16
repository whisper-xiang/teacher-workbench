import { calcGradeTotal } from '../data/store'
import { letterGrade, type Course, type GradeItem, type StudentRecord } from '../data/types'

function csvCell(value: string | number) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || '成绩'
}

export function buildGradeCsv(
  roster: StudentRecord[],
  grades: GradeItem[],
  courseId: string,
): string {
  const header = ['学号', '姓名', '平时', '期中', '期末', '总评', '等级']
  const rows = roster.map((student) => {
    const grade = grades.find((item) => item.studentId === student.id && item.courseId === courseId)
    const usual = grade?.usual ?? student.processScore
    const midterm = grade?.midterm ?? 0
    const final = grade?.final ?? 0
    const total = grade?.total ?? calcGradeTotal(usual, midterm, final)
    return [
      student.number,
      student.name,
      usual,
      midterm,
      final || '',
      total,
      letterGrade(total).grade,
    ]
  })
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}`
}

export function downloadGradeCsv(course: Course, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeFileName(course.name)}-成绩.csv`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
