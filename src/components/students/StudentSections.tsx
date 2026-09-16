import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Course, GradeItem, StudentRecord } from '../../data/types'
import { letterGrade } from '../../data/types'
import { calcGradeTotal } from '../../data/store'
import { MajorTag } from '../MajorTag'

export type StudentDraft = {
  id: string
  name: string
  number: string
  notes: string
  usual: string
  midterm: string
  final: string
}

type StudentRosterTableProps = {
  students: StudentRecord[]
  rosterSize: number
  hasCourse: boolean
  gradeFor: (studentId: string) => GradeItem | undefined
  onEditStudent: (student: StudentRecord) => void
  onGradeChange: (student: StudentRecord, field: 'usual' | 'midterm' | 'final', value: number) => void
}

function gradeValue(grade: GradeItem | undefined, student: StudentRecord, field: 'usual' | 'midterm' | 'final') {
  if (field === 'usual') return String(grade?.usual ?? student.processScore)
  if (field === 'final') return grade?.final ? String(grade.final) : ''
  return grade?.midterm != null ? String(grade.midterm) : ''
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

function draftPreview(draft: StudentDraft) {
  const usual = clampScore(Number(draft.usual) || 0)
  const midterm = clampScore(Number(draft.midterm) || 0)
  const final = clampScore(Number(draft.final) || 0)
  const total = calcGradeTotal(usual, midterm, final)
  const filledCount = [draft.usual, draft.midterm, draft.final].filter((value) => value.trim() !== '').length
  return { total, letter: letterGrade(total), showTotal: Boolean(draft.id) || filledCount >= 2 }
}

export function StudentRosterTable({
  students,
  rosterSize,
  hasCourse,
  gradeFor,
  onEditStudent,
  onGradeChange,
}: StudentRosterTableProps) {
  return (
    <div className="students-table-wrap">
      <table className="students-table">
        <thead>
          <tr>
            <th>学生</th>
            <th>平时</th>
            <th>期中</th>
            <th>期末</th>
            <th>总评</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const grade = gradeFor(student.id)
            const usual = grade?.usual ?? student.processScore
            const total = grade?.total ?? usual
            const letter = letterGrade(total)
            return (
              <tr key={student.id}>
                <td>
                  <button type="button" className="student-name-btn" onClick={() => onEditStudent(student)}>
                    <strong>{student.name}</strong>
                    <small>{student.number || '无学号'}</small>
                  </button>
                </td>
                {(['usual', 'midterm', 'final'] as const).map((field) => (
                  <td key={field}>
                    <input
                      className="grade-input"
                      value={gradeValue(grade, student, field)}
                      onChange={(event) => onGradeChange(student, field, Number(event.target.value) || 0)}
                      inputMode="numeric"
                      aria-label={`${student.name} ${field === 'usual' ? '平时' : field === 'midterm' ? '期中' : '期末'}成绩`}
                    />
                  </td>
                ))}
                <td>
                  <strong className={`letter-${letter.tone}`}>
                    {total} {letter.grade}
                  </strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {students.length === 0 && (
        <div className="students-empty">
          {rosterSize === 0 ? (hasCourse ? '这门课还没有花名册，可以添加或导入。' : '先选课程，粘贴名单即可') : '没有匹配的学生。'}
        </div>
      )}
    </div>
  )
}

type StudentDialogsProps = {
  course?: Course
  studentDraft: StudentDraft | null
  onStudentDraftChange: (draft: StudentDraft | null) => void
  onSaveStudent: (event: React.FormEvent) => void
  onRemoveStudent: (id: string) => void
}

export function StudentDialogs({
  course,
  studentDraft,
  onStudentDraftChange,
  onSaveStudent,
  onRemoveStudent,
}: StudentDialogsProps) {
  useEffect(() => {
    if (!studentDraft) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onStudentDraftChange(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [studentDraft, onStudentDraftChange])

  const preview = studentDraft ? draftPreview(studentDraft) : null
  const studentDialog =
    studentDraft && course ? (
      <div className="students-modal-backdrop" onMouseDown={() => onStudentDraftChange(null)}>
        <form
          className="students-composer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-dialog-title"
          onSubmit={onSaveStudent}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="students-composer-head">
            <div>
              <p className="section-label">{studentDraft.id ? '过程性评价' : '添加学生'}</p>
              <h2 id="student-dialog-title">
                {studentDraft.id ? studentDraft.name || '未命名' : '新学生'}
                {studentDraft.id && <MajorTag major={course.major} compact />}
              </h2>
              <p className="students-composer-meta">{course.name}</p>
            </div>
            <button type="button" className="students-composer-close" onClick={() => onStudentDraftChange(null)} aria-label="关闭">
              ×
            </button>
          </div>

          <div className="students-composer-body">
            <div className="composer-grid">
              <label>
                姓名
                <input
                  required
                  autoFocus
                  autoComplete="off"
                  value={studentDraft.name}
                  onChange={(event) => onStudentDraftChange({ ...studentDraft, name: event.target.value })}
                />
              </label>
              <label>
                学号
                <input
                  autoComplete="off"
                  value={studentDraft.number}
                  onChange={(event) => onStudentDraftChange({ ...studentDraft, number: event.target.value })}
                />
              </label>
            </div>

            <div className="students-score-panel">
              <div className="students-score-head">
                <span>成绩</span>
                {preview?.showTotal && (
                  <strong className={`letter-${preview.letter.tone}`}>
                    总评 {preview.total} {preview.letter.grade}
                  </strong>
                )}
              </div>
              <div className="students-score-grid">
                <label>
                  平时
                  <input
                    inputMode="numeric"
                    value={studentDraft.usual}
                    onChange={(event) => onStudentDraftChange({ ...studentDraft, usual: event.target.value })}
                  />
                </label>
                <label>
                  期中
                  <input
                    inputMode="numeric"
                    value={studentDraft.midterm}
                    onChange={(event) => onStudentDraftChange({ ...studentDraft, midterm: event.target.value })}
                  />
                </label>
                <label>
                  期末
                  <input
                    inputMode="numeric"
                    value={studentDraft.final}
                    onChange={(event) => onStudentDraftChange({ ...studentDraft, final: event.target.value })}
                  />
                </label>
              </div>
              <p className="students-score-hint">平时 30%、期中 30%、期末 40%。期末未填时按平时与期中折算。</p>
            </div>

            <label>
              备注
              <textarea rows={3} value={studentDraft.notes} onChange={(event) => onStudentDraftChange({ ...studentDraft, notes: event.target.value })} />
            </label>
          </div>

          <div className={`composer-actions${studentDraft.id ? ' composer-actions-split' : ''}`}>
            {studentDraft.id && (
              <button type="button" className="danger-action" onClick={() => onRemoveStudent(studentDraft.id)}>
                移除
              </button>
            )}
            <div className="composer-actions-right">
              <button type="button" className="outline-action" onClick={() => onStudentDraftChange(null)}>
                取消
              </button>
              <button type="submit" className="primary-action">
                保存
              </button>
            </div>
          </div>
        </form>
      </div>
    ) : null

  return <>{studentDialog ? createPortal(studentDialog, document.body) : null}</>
}
