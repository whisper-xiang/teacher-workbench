import { useEffect, useMemo, useState } from 'react'
import '../components/course-tabs.css'
import '../students.css'
import { calcGradeTotal, uid } from '../data/store'
import type { Course, GradeItem, StudentObservation, StudentRecord } from '../data/types'
import {
  StudentDialogs,
  StudentRosterTable,
  type StudentDraft,
} from '../components/students/StudentSections'
import { RosterImportDialog } from '../components/students/RosterImportDialog'
import { buildGradeCsv, downloadGradeCsv } from '../lib/grade-csv'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'
import { hasLlmSettings } from '../lib/llm-settings'
import { localUsualScores, proposeUsualScores, type UsualScoreDraft } from '../lib/usual-from-notes'
import { todayIso } from '../lib/dates'

type Props = {
  courses: Course[]
  students: StudentRecord[]
  grades: GradeItem[]
  initialCourseId?: string
  onChangeStudents: (students: StudentRecord[]) => void
  onChangeGrades: (grades: GradeItem[]) => void
  onOpenSettings?: () => void
  onBack?: () => void
}

function emptyStudentDraft(): StudentDraft {
  return {
    id: '',
    name: '',
    number: '',
    notes: '',
    usual: '',
    midterm: '',
    final: '',
    observations: [],
    newObservation: '',
  }
}

function notesFromObservations(observations: StudentObservation[], fallback = '') {
  const latest = observations[0]?.text.trim()
  return latest || fallback
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

export function StudentsPage({
  courses,
  students,
  grades,
  initialCourseId,
  onChangeStudents,
  onChangeGrades,
  onOpenSettings,
  onBack,
}: Props) {
  const [courseId, setCourseId] = useState(initialCourseId || courses[0]?.id || '')
  const [query, setQuery] = useState('')
  const [studentDraft, setStudentDraft] = useState<StudentDraft | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [usualDrafts, setUsualDrafts] = useState<UsualScoreDraft[] | null>(null)
  const [usualBusy, setUsualBusy] = useState(false)
  const [usualLocal, setUsualLocal] = useState(false)

  useEffect(() => {
    if (initialCourseId && courses.some((course) => course.id === initialCourseId)) {
      setCourseId(initialCourseId)
      setQuery('')
    }
  }, [initialCourseId, courses])

  const course = courses.find((item) => item.id === courseId) ?? courses[0]
  const activeCourseId = course?.id ?? ''

  const roster = useMemo(
    () => students.filter((item) => item.courseId === activeCourseId),
    [students, activeCourseId],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((item) => `${item.name}${item.number}${item.notes}`.toLowerCase().includes(q))
  }, [roster, query])

  const gradeOf = (studentId: string) =>
    grades.find((item) => item.studentId === studentId && item.courseId === activeCourseId)

  const openEdit = (student: StudentRecord) => {
    const grade = gradeOf(student.id)
    setStudentDraft({
      id: student.id,
      name: student.name,
      number: student.number,
      notes: student.notes,
      usual: String(grade?.usual ?? student.processScore),
      midterm: grade?.midterm != null ? String(grade.midterm) : '',
      final: grade?.final ? String(grade.final) : '',
      observations: student.observations ?? [],
      newObservation: '',
    })
  }

  const saveStudent = (event: React.FormEvent) => {
    event.preventDefault()
    if (!studentDraft?.name.trim() || !course) return
    const name = studentDraft.name.trim()
    const usual = clampScore(Number(studentDraft.usual) || 0)
    const midterm = clampScore(Number(studentDraft.midterm) || 0)
    const final = clampScore(Number(studentDraft.final) || 0)
    const total = calcGradeTotal(usual, midterm, final)
    const existing = studentDraft.id ? students.find((item) => item.id === studentDraft.id) : undefined
    const nextStudent: StudentRecord = {
      id: studentDraft.id || uid('stu'),
      name,
      number: studentDraft.number.trim(),
      group: existing?.group ?? '未分组',
      attendance: existing?.attendance ?? '100%',
      homework: existing?.homework ?? '0 / 0',
      status: existing?.status ?? '正常',
      courseId: course.id,
      className: course.className,
      major: course.major,
      processScore: usual,
      notes: notesFromObservations(studentDraft.observations, studentDraft.notes.trim()),
      observations: studentDraft.observations,
    }
    const nextStudents = studentDraft.id
      ? students.map((item) => (item.id === studentDraft.id ? nextStudent : item))
      : [...students, nextStudent]
    onChangeStudents(nextStudents)

    const existingGrade = gradeOf(nextStudent.id)
    const nextGrade: GradeItem = {
      id: existingGrade?.id || uid('grade'),
      courseId: course.id,
      studentId: nextStudent.id,
      usual,
      midterm,
      final,
      total,
    }
    onChangeGrades(
      existingGrade
        ? grades.map((item) => (item.id === existingGrade.id ? nextGrade : item))
        : [...grades, nextGrade],
    )
    notify.success(studentDraft.id ? `已更新「${name}」` : `已加入「${name}」`)
    setStudentDraft(null)
  }

  const addObservation = () => {
    if (!studentDraft?.newObservation.trim()) return
    const next: StudentObservation = {
      id: uid('obs'),
      date: todayIso(),
      text: studentDraft.newObservation.trim(),
    }
    setStudentDraft({
      ...studentDraft,
      observations: [next, ...studentDraft.observations],
      newObservation: '',
      notes: next.text,
    })
  }

  const removeObservation = (id: string) => {
    if (!studentDraft) return
    const observations = studentDraft.observations.filter((item) => item.id !== id)
    setStudentDraft({
      ...studentDraft,
      observations,
      notes: notesFromObservations(observations, studentDraft.notes),
    })
  }

  const generateUsual = async () => {
    if (!course || !roster.length) return
    setUsualBusy(true)
    try {
      if (hasLlmSettings()) {
        const drafts = await proposeUsualScores(roster, course.name)
        setUsualDrafts(drafts)
        setUsualLocal(false)
        notify.success('已根据课堂表现拟出平时成绩，确认后写入')
      } else {
        setUsualDrafts(localUsualScores(roster))
        setUsualLocal(true)
        notify.warning('还没配置模型，先按文字做了本机粗估。到设置填写后可再智能生成。')
      }
    } catch (error) {
      setUsualDrafts(localUsualScores(roster))
      setUsualLocal(true)
      notify.error(error instanceof Error ? error.message : '生成失败，已改用本机粗估')
      if (String(error instanceof Error ? error.message : '').includes('设置')) onOpenSettings?.()
    } finally {
      setUsualBusy(false)
    }
  }

  const applyUsualDrafts = () => {
    if (!course || !usualDrafts?.length) return
    let nextGrades = grades
    let nextStudents = students
    for (const draft of usualDrafts) {
      const student = nextStudents.find((item) => item.id === draft.studentId)
      if (!student) continue
      const usual = clampScore(draft.usual)
      const current = nextGrades.find((item) => item.studentId === student.id && item.courseId === course.id)
      const midterm = current?.midterm ?? 0
      const final = current?.final ?? 0
      const nextGrade: GradeItem = {
        id: current?.id || uid('grade'),
        courseId: course.id,
        studentId: student.id,
        usual,
        midterm,
        final,
        total: calcGradeTotal(usual, midterm, final),
      }
      nextGrades = current
        ? nextGrades.map((item) => (item.id === current.id ? nextGrade : item))
        : [...nextGrades, nextGrade]
      nextStudents = nextStudents.map((item) => (item.id === student.id ? { ...item, processScore: usual } : item))
    }
    onChangeGrades(nextGrades)
    onChangeStudents(nextStudents)
    setUsualDrafts(null)
    notify.success(`已写入「${course.name}」${usualDrafts.length} 人平时成绩`)
  }

  const removeStudent = async (id: string) => {
    const item = students.find((student) => student.id === id)
    if (!item) return
    try {
      await confirm.delete(`确定从花名册移除「${item.name}」？`)
    } catch {
      return
    }
    onChangeStudents(students.filter((student) => student.id !== id))
    onChangeGrades(grades.filter((grade) => grade.studentId !== id))
    notify.warning(`已移除：${item.name}`, '已删除')
    setStudentDraft(null)
  }

  const updateGradeField = (student: StudentRecord, field: 'usual' | 'midterm' | 'final', value: number) => {
    const current = gradeOf(student.id)
    const usual = field === 'usual' ? clampScore(value) : current?.usual ?? student.processScore
    const midterm = field === 'midterm' ? clampScore(value) : current?.midterm ?? 0
    const final = field === 'final' ? clampScore(value) : current?.final ?? 0
    const total = calcGradeTotal(usual, midterm, final)
    const next: GradeItem = {
      id: current?.id || uid('grade'),
      courseId: activeCourseId,
      studentId: student.id,
      usual,
      midterm,
      final,
      total,
    }
    onChangeGrades(current ? grades.map((item) => (item.id === current.id ? next : item)) : [...grades, next])
    if (field === 'usual') {
      onChangeStudents(students.map((item) => (item.id === student.id ? { ...item, processScore: usual } : item)))
    }
  }

  const exportGrades = () => {
    if (!course || !roster.length) return
    downloadGradeCsv(course, buildGradeCsv(roster, grades, activeCourseId))
    notify.success(`已导出「${course.name}」${roster.length} 人成绩`)
  }

  return (
    <section className="students-page" aria-label="学生与评价">
      <div className="students-heading">
        <div>
          <p className="section-label">日常工作</p>
          <h1>学生与评价</h1>
          <p>学期初导入花名册，学期中补课堂表现，期末据此生成平时成绩。</p>
        </div>
        <div className="students-heading-actions">
          {onBack && (
            <button type="button" className="outline-action" onClick={onBack}>
              ← 返回教学
            </button>
          )}
          <button type="button" className="outline-action" disabled={!course} onClick={() => setImportOpen(true)}>
            导入花名册
          </button>
          <button
            type="button"
            className="outline-action"
            disabled={!roster.length || usualBusy}
            onClick={() => void generateUsual()}
          >
            {usualBusy ? '正在生成…' : '生成平时成绩'}
          </button>
          <button type="button" className="outline-action" disabled={!roster.length} onClick={exportGrades}>
            导出成绩
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={!course}
            onClick={() => setStudentDraft(emptyStudentDraft())}
          >
            ＋ 添加学生
          </button>
        </div>
      </div>

      <div className="students-course-tabs" role="tablist" aria-label="选择课程">
        {courses.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === activeCourseId}
            className={item.id === activeCourseId ? 'active' : ''}
            onClick={() => {
              setCourseId(item.id)
              setQuery('')
            }}
          >
            {item.name}
            <small>{students.filter((student) => student.courseId === item.id).length}</small>
          </button>
        ))}
      </div>

      <div className="students-toolbar">
        <label className="students-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、学号或备注" />
        </label>
      </div>

      <StudentRosterTable
        students={visible}
        rosterSize={roster.length}
        hasCourse={Boolean(course)}
        gradeFor={gradeOf}
        onEditStudent={openEdit}
        onGradeChange={updateGradeField}
      />

      <StudentDialogs
        course={course}
        studentDraft={studentDraft}
        onStudentDraftChange={setStudentDraft}
        onSaveStudent={saveStudent}
        onRemoveStudent={(id) => void removeStudent(id)}
        onAddObservation={addObservation}
        onRemoveObservation={removeObservation}
      />
      {usualDrafts ? (
        <div className="students-modal-backdrop" onMouseDown={() => setUsualDrafts(null)}>
          <div
            className="students-composer students-usual-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="usual-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="students-composer-head">
              <div>
                <p className="section-label">{usualLocal ? '本机粗估' : '智能分析'}</p>
                <h2 id="usual-dialog-title">平时成绩草案</h2>
                <p className="students-composer-meta">{course?.name} · 确认后写入平时分，仍可再改</p>
              </div>
              <button type="button" className="students-composer-close" onClick={() => setUsualDrafts(null)} aria-label="关闭">
                ×
              </button>
            </div>
            <ul className="students-usual-list">
              {usualDrafts.map((item) => (
                <li key={item.studentId}>
                  <strong>{item.name}</strong>
                  <input
                    className="grade-input"
                    inputMode="numeric"
                    value={item.usual}
                    onChange={(event) =>
                      setUsualDrafts(
                        usualDrafts.map((row) =>
                          row.studentId === item.studentId
                            ? { ...row, usual: clampScore(Number(event.target.value) || 0) }
                            : row,
                        ),
                      )
                    }
                    aria-label={`${item.name} 平时成绩`}
                  />
                  <span>{item.reason}</span>
                </li>
              ))}
            </ul>
            <div className="composer-actions">
              {usualLocal && onOpenSettings ? (
                <button type="button" className="text-action" onClick={onOpenSettings}>
                  去设置模型
                </button>
              ) : (
                <span />
              )}
              <div className="composer-actions-right">
                <button type="button" className="outline-action" onClick={() => setUsualDrafts(null)}>
                  取消
                </button>
                <button type="button" className="primary-action" onClick={applyUsualDrafts}>
                  写入平时成绩
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <RosterImportDialog
        open={importOpen}
        course={course}
        roster={roster}
        students={students}
        grades={grades}
        onClose={() => setImportOpen(false)}
        onApply={(next) => {
          onChangeStudents(next.students)
          onChangeGrades(next.grades)
        }}
      />
    </section>
  )
}
