import { useEffect, useMemo, useRef, useState } from 'react'
import { uid } from '../../data/store'
import { letterGrade, type Course, type GradeItem, type StudentRecord } from '../../data/types'
import { confirm } from '../../lib/confirm'
import {
  defaultWeightsFor,
  officialTotal,
  scoresOf,
  tallyLetters,
  weightedTotal,
  weightsSum,
  type GradeWeights,
} from '../../lib/classroom-tools'
import { notify } from '../../lib/notify'
import { ToolCourseTabs } from './ToolCourseTabs'

type Props = {
  courses: Course[]
  students: StudentRecord[]
  grades: GradeItem[]
  onChangeGrades: (grades: GradeItem[]) => void
  onOpenStudents: (courseId: string) => void
}

function clampWeight(value: number) {
  return Math.max(0, Math.min(100, Math.round(value) || 0))
}

export function GradeSimPanel({ courses, students, grades, onChangeGrades, onOpenStudents }: Props) {
  const defaultCourseId =
    courses.find((course) => students.some((student) => student.courseId === course.id))?.id ?? courses[0]?.id ?? ''
  const [courseId, setCourseId] = useState(defaultCourseId)
  const [weights, setWeights] = useState<GradeWeights>({ usual: 50, midterm: 50, final: 0 })
  const weightCourseId = useRef('')

  const course = courses.find((item) => item.id === courseId) ?? courses[0]
  const activeCourseId = course?.id ?? ''
  const roster = useMemo(
    () => students.filter((item) => item.courseId === activeCourseId),
    [students, activeCourseId],
  )

  const gradeOf = (studentId: string) =>
    grades.find((item) => item.studentId === studentId && item.courseId === activeCourseId)

  useEffect(() => {
    if (weightCourseId.current === activeCourseId) return
    weightCourseId.current = activeCourseId
    const current = students
      .filter((item) => item.courseId === activeCourseId)
      .map((student) =>
        scoresOf(
          student,
          grades.find((item) => item.studentId === student.id && item.courseId === activeCourseId),
        ),
      )
    setWeights(defaultWeightsFor(current))
  }, [activeCourseId, students, grades])

  const rows = roster.map((student) => {
    const grade = gradeOf(student.id)
    const scores = scoresOf(student, grade)
    const current = grade?.total ?? officialTotal(scores.usual, scores.midterm, scores.final)
    const simulated = weightedTotal(scores.usual, scores.midterm, scores.final, weights)
    return { student, scores, current, simulated }
  })

  const sum = weightsSum(weights)
  const currentTally = tallyLetters(rows.map((row) => row.current))
  const simTally = tallyLetters(rows.map((row) => row.simulated))
  const hasFinal = rows.some((row) => row.scores.final > 0)
  const canWrite = roster.length > 0 && sum > 0

  const setField = (field: keyof GradeWeights, value: string) => {
    setWeights((current) => ({ ...current, [field]: clampWeight(Number(value)) }))
  }

  const writeTotals = async () => {
    if (!course || !canWrite) return
    try {
      await confirm.warning(
        `将按平时 ${weights.usual}%、期中 ${weights.midterm}%、期末 ${weights.final}% 写入「${course.name}」${roster.length} 人的总评。学生页里再改分会按默认 30/30/40 重算。`,
        '写入总评？',
        { confirmButtonText: '写入' },
      )
    } catch {
      return
    }

    let next = [...grades]
    for (const row of rows) {
      const existing = gradeOf(row.student.id)
      const item: GradeItem = {
        id: existing?.id || uid('grade'),
        courseId: activeCourseId,
        studentId: row.student.id,
        usual: row.scores.usual,
        midterm: row.scores.midterm,
        final: row.scores.final,
        total: row.simulated,
      }
      next = existing ? next.map((grade) => (grade.id === existing.id ? item : grade)) : [...next, item]
    }
    onChangeGrades(next)
    notify.success(`已写入「${course.name}」${roster.length} 人总评`)
  }

  if (!courses.length) {
    return (
      <div className="tools-empty">
        <h3>还没有课程</h3>
        <p>先在教学页排课，再试算总评。</p>
      </div>
    )
  }

  return (
    <div className="tools-native-body">
      <ToolCourseTabs courses={courses} students={students} courseId={activeCourseId} onChange={setCourseId} />

      {roster.length === 0 ? (
        <div className="tools-empty">
          <h3>这门课还没有花名册</h3>
          <p>有名单才能按人预览等级。</p>
          <button type="button" className="text-action" onClick={() => onOpenStudents(activeCourseId)}>
            去学生页导入
          </button>
        </div>
      ) : (
        <>
          <div className="tools-weight-row">
            {([
              ['usual', '平时 %'],
              ['midterm', '期中 %'],
              ['final', '期末 %'],
            ] as const).map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={weights[field]}
                  onChange={(event) => setField(field, event.target.value)}
                />
              </label>
            ))}
            <p className={`tools-weight-sum${sum === 100 ? '' : ' is-warn'}`}>合计 {sum}</p>
          </div>
          {!hasFinal && weights.final > 0 && (
            <p className="tools-hint">这门课还没有期末分，试算时期末按 0。可以把期末权重调成 0。</p>
          )}
          <p className="tools-tally">
            现等级 {formatTally(currentTally)}
            <span aria-hidden="true"> · </span>
            试算后 {formatTally(simTally)}
          </p>
          <div className="tools-table-wrap">
            <table className="tools-table">
              <thead>
                <tr>
                  <th>学生</th>
                  <th>平时</th>
                  <th>期中</th>
                  <th>期末</th>
                  <th>现总评</th>
                  <th>试算</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const currentLetter = letterGrade(row.current)
                  const simLetter = letterGrade(row.simulated)
                  const changed = row.simulated !== row.current
                  return (
                    <tr key={row.student.id}>
                      <td>
                        <strong>{row.student.name}</strong>
                        <small>{row.student.number || '无学号'}</small>
                      </td>
                      <td>{row.scores.usual}</td>
                      <td>{row.scores.midterm || '—'}</td>
                      <td>{row.scores.final || '—'}</td>
                      <td>
                        {row.current} {currentLetter.grade}
                      </td>
                      <td className={changed ? 'is-changed' : undefined}>
                        {row.simulated} {simLetter.grade}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="tools-native-actions">
            <button type="button" className="primary-action" disabled={!canWrite} onClick={() => void writeTotals()}>
              写入总评
            </button>
            <button type="button" className="text-action" onClick={() => onOpenStudents(activeCourseId)}>
              去学生页改分
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function formatTally(counts: ReturnType<typeof tallyLetters>) {
  return (['A', 'B', 'C', 'D', 'F'] as const)
    .filter((key) => counts[key] > 0)
    .map((key) => `${key} ${counts[key]}`)
    .join(' · ')
}
