import { useEffect, useMemo, useState } from 'react'
import '../components/course-tabs.css'
import '../students.css'
import { calcGradeTotal, uid } from '../data/store'
import type { Assignment, Course, GradeItem, StudentRecord } from '../data/types'
import {
  AssignmentPanel,
  StudentDialogs,
  StudentRosterTable,
  type AssignmentDraft,
  type StudentDraft,
} from '../components/students/StudentSections'
import { STUDENT_STATUSES } from '../components/students/student-model'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'

type Props = {
  courses: Course[]
  students: StudentRecord[]
  assignments: Assignment[]
  grades: GradeItem[]
  initialCourseId?: string
  onChangeStudents: (students: StudentRecord[]) => void
  onChangeAssignments: (assignments: Assignment[]) => void
  onChangeGrades: (grades: GradeItem[]) => void
  onBack?: () => void
}

function homeworkText(student: StudentRecord, assignments: Assignment[]) {
  const list = assignments.filter((item) => item.courseId === student.courseId)
  if (!list.length) return student.homework || '0 / 0'
  const done = list.filter((item) => item.reviewed.includes(student.name)).length
  return `${done} / ${list.length}`
}

function parseRoster(text: string, course: Course): Omit<StudentRecord, 'id'>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const rows = lines.map((line) => line.split(/[,，\t;；]/).map((cell) => cell.trim()))
  const header = /姓名|学号|名字/.test(rows[0]?.join('') ?? '')
  const data = header ? rows.slice(1) : rows
  return data
    .map(([name, number, group]) => ({
      name: name ?? '',
      number: number ?? '',
      group: group || '未分组',
      attendance: '100%',
      homework: '0 / 0',
      status: '正常' as const,
      courseId: course.id,
      className: course.className,
      major: course.major,
      processScore: 0,
      notes: '',
    }))
    .filter((item) => item.name)
}

function emptyStudentDraft(): StudentDraft {
  return {
    id: '',
    name: '',
    number: '',
    group: '未分组',
    attendance: '100%',
    processScore: '0',
    status: '正常',
    notes: '',
    usual: '0',
    midterm: '0',
    final: '0',
  }
}

export function StudentsPage({
  courses,
  students,
  assignments,
  grades,
  initialCourseId,
  onChangeStudents,
  onChangeAssignments,
  onChangeGrades,
  onBack,
}: Props) {
  const [courseId, setCourseId] = useState(initialCourseId || courses[0]?.id || '')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'全部' | StudentRecord['status']>('全部')
  const [selected, setSelected] = useState<string[]>([])
  const [studentDraft, setStudentDraft] = useState<StudentDraft | null>(null)
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft | null>(null)
  const [importText, setImportText] = useState<string | null>(null)

  useEffect(() => {
    if (initialCourseId && courses.some((course) => course.id === initialCourseId)) {
      setCourseId(initialCourseId)
    }
  }, [initialCourseId, courses])

  const course = courses.find((item) => item.id === courseId) ?? courses[0]
  const activeCourseId = course?.id ?? ''

  const roster = useMemo(
    () => students.filter((item) => item.courseId === activeCourseId),
    [students, activeCourseId],
  )
  const courseAssignments = useMemo(
    () => assignments.filter((item) => item.courseId === activeCourseId),
    [assignments, activeCourseId],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return roster.filter((item) => {
      if (statusFilter !== '全部' && item.status !== statusFilter) return false
      if (!q) return true
      return `${item.name}${item.number}${item.group}${item.notes}`.toLowerCase().includes(q)
    })
  }, [roster, query, statusFilter])

  const followCount = roster.filter((item) => item.status !== '正常').length
  const pendingReview = courseAssignments.reduce(
    (sum, item) => sum + Math.max(0, (item.total ?? roster.length) - item.reviewed.length),
    0,
  )

  const gradeOf = (studentId: string) =>
    grades.find((item) => item.studentId === studentId && item.courseId === activeCourseId)

  const refreshHomework = (nextStudents: StudentRecord[], nextAssignments: Assignment[]) =>
    nextStudents.map((item) => ({ ...item, homework: homeworkText(item, nextAssignments) }))

  const openEdit = (student: StudentRecord) => {
    const grade = gradeOf(student.id)
    setStudentDraft({
      id: student.id,
      name: student.name,
      number: student.number,
      group: student.group,
      attendance: student.attendance,
      processScore: String(student.processScore),
      status: student.status,
      notes: student.notes,
      usual: String(grade?.usual ?? student.processScore),
      midterm: String(grade?.midterm ?? 0),
      final: String(grade?.final ?? 0),
    })
  }

  const saveStudent = (event: React.FormEvent) => {
    event.preventDefault()
    if (!studentDraft?.name.trim() || !course) return
    const name = studentDraft.name.trim()
    const usual = Math.max(0, Number(studentDraft.usual) || 0)
    const midterm = Math.max(0, Number(studentDraft.midterm) || 0)
    const final = Math.max(0, Number(studentDraft.final) || 0)
    const total = calcGradeTotal(usual, midterm, final)
    const processScore = Math.max(0, Math.min(100, Number(studentDraft.processScore) || 0))
    const existing = studentDraft.id ? students.find((item) => item.id === studentDraft.id) : undefined
    const nextStudent: StudentRecord = {
      id: studentDraft.id || uid('stu'),
      name,
      number: studentDraft.number.trim(),
      group: studentDraft.group.trim() || '未分组',
      attendance: studentDraft.attendance.trim() || '100%',
      homework: existing?.homework ?? homeworkText({ ...existing, name, courseId: course.id } as StudentRecord, assignments),
      status: studentDraft.status,
      courseId: course.id,
      className: course.className,
      major: course.major,
      processScore,
      notes: studentDraft.notes.trim(),
    }
    const nextStudents = studentDraft.id
      ? students.map((item) => (item.id === studentDraft.id ? nextStudent : item))
      : [...students, nextStudent]
    onChangeStudents(refreshHomework(nextStudents, assignments))

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

  const applyBatch = (status: StudentRecord['status']) => {
    if (!selected.length) return
    onChangeStudents(
      students.map((item) => (selected.includes(item.id) ? { ...item, status } : item)),
    )
    notify.success(`已将 ${selected.length} 人标记为「${status}」`)
    setSelected([])
  }

  const markAttendance = (kind: '到勤' | '迟交') => {
    if (!selected.length) return
    const stamp = kind === '到勤' ? '本次到勤' : '本次迟交'
    onChangeStudents(
      students.map((item) => {
        if (!selected.includes(item.id)) return item
        const notes = item.notes.includes(stamp) ? item.notes : `${item.notes ? `${item.notes}；` : ''}${stamp}`
        return {
          ...item,
          notes,
          status: kind === '迟交' ? '关注' : item.status === '待跟进' ? item.status : '正常',
          attendance: kind === '到勤' ? item.attendance : item.attendance,
        }
      }),
    )
    notify.success(`已为 ${selected.length} 人记录「${stamp}」`)
    setSelected([])
  }

  const toggleReviewed = (assignment: Assignment, studentName: string) => {
    const reviewed = assignment.reviewed.includes(studentName)
      ? assignment.reviewed.filter((name) => name !== studentName)
      : [...assignment.reviewed, studentName]
    const nextAssignments = assignments.map((item) => (item.id === assignment.id ? { ...item, reviewed } : item))
    onChangeAssignments(nextAssignments)
    onChangeStudents(refreshHomework(students, nextAssignments))
  }

  const saveAssignment = (event: React.FormEvent) => {
    event.preventDefault()
    if (!assignmentDraft?.title.trim() || !course) return
    const next: Assignment = {
      id: uid('asg'),
      courseId: course.id,
      title: assignmentDraft.title.trim(),
      due: assignmentDraft.due ? `${assignmentDraft.due}T23:59` : '',
      description: assignmentDraft.description.trim(),
      reviewed: [],
      submitted: 0,
      total: roster.length || course.students,
      major: course.major,
    }
    const nextAssignments = [...assignments, next]
    onChangeAssignments(nextAssignments)
    onChangeStudents(refreshHomework(students, nextAssignments))
    notify.success(`已发布「${next.title}」`)
    setAssignmentDraft(null)
  }

  const removeAssignment = async (id: string) => {
    const item = assignments.find((assignment) => assignment.id === id)
    if (!item) return
    try {
      await confirm.delete(`确定删除作业「${item.title}」？`)
    } catch {
      return
    }
    const nextAssignments = assignments.filter((assignment) => assignment.id !== id)
    onChangeAssignments(nextAssignments)
    onChangeStudents(refreshHomework(students, nextAssignments))
    notify.warning(`已删除：${item.title}`, '已删除')
  }

  const importRoster = () => {
    if (!importText?.trim() || !course) return
    const rows = parseRoster(importText, course)
    if (!rows.length) {
      notify.warning('没有识别到学生，请按「姓名,学号,小组」每行一人')
      return
    }
    const existingNumbers = new Set(roster.map((item) => item.number).filter(Boolean))
    const existingNames = new Set(roster.map((item) => item.name))
    const fresh = rows.filter((item) => !existingNames.has(item.name) && (!item.number || !existingNumbers.has(item.number)))
    if (!fresh.length) {
      notify.info('名单中的学生已在花名册中')
      setImportText(null)
      return
    }
    const nextStudents = [...students, ...fresh.map((item) => ({ ...item, id: uid('stu') }))]
    onChangeStudents(refreshHomework(nextStudents, assignments))
    notify.success(`已导入 ${fresh.length} 人`)
    setImportText(null)
  }

  const updateGradeField = (student: StudentRecord, field: 'usual' | 'midterm' | 'final', value: number) => {
    const current = gradeOf(student.id)
    const usual = field === 'usual' ? value : current?.usual ?? student.processScore
    const midterm = field === 'midterm' ? value : current?.midterm ?? 0
    const final = field === 'final' ? value : current?.final ?? 0
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

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const selectVisible = () => {
    const ids = visible.map((item) => item.id)
    setSelected(selected.length === ids.length ? [] : ids)
  }

  return (
    <section className="students-page" aria-label="学生与评价">
      <div className="students-heading">
        <div>
          <p className="section-label">日常工作</p>
          <h1>学生与评价</h1>
          <p>过程性评价、作业批改与总评登记 · 数据仅保存在本机</p>
        </div>
        <div className="students-heading-actions">
          {onBack && (
            <button type="button" className="outline-action" onClick={onBack}>
              ← 返回教学
            </button>
          )}
          <button type="button" className="outline-action" onClick={() => setImportText('')}>
            导入花名册
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

      <div className="students-notice">
        <span aria-hidden="true">ℹ</span>
        <span>平时 / 期中 / 期末按 30% · 30% · 40% 折算；期末未录入时按已有分项折合。</span>
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
              setSelected([])
            }}
          >
            {item.name}
            <small>{students.filter((student) => student.courseId === item.id).length}</small>
          </button>
        ))}
      </div>

      {course && (
        <div className="students-overview">
          <div>
            <span>花名册</span>
            <strong>{roster.length}</strong>
            <small>课程登记 {course.students} 人</small>
          </div>
          <div>
            <span>需关注</span>
            <strong>{followCount}</strong>
            <small>关注 / 待跟进</small>
          </div>
          <div>
            <span>待批改</span>
            <strong>{pendingReview}</strong>
            <small>{courseAssignments.length} 项作业</small>
          </div>
        </div>
      )}

      <div className="students-toolbar">
        <label className="students-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、学号或备注" />
        </label>
        <div className="students-filters">
          {(['全部', ...STUDENT_STATUSES] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={statusFilter === item ? 'active' : ''}
              onClick={() => setStatusFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="students-batch">
          <span>已选 {selected.length} 人</span>
          <button type="button" onClick={() => markAttendance('到勤')}>
            本次到勤
          </button>
          <button type="button" onClick={() => markAttendance('迟交')}>
            本次迟交
          </button>
          {STUDENT_STATUSES.map((status) => (
            <button type="button" key={status} onClick={() => applyBatch(status)}>
              标为{status}
            </button>
          ))}
        </div>
      )}

      <StudentRosterTable
        students={visible}
        selectedIds={selected}
        rosterSize={roster.length}
        hasCourse={Boolean(course)}
        gradeFor={gradeOf}
        onToggleStudent={toggleSelect}
        onToggleVisible={selectVisible}
        onEditStudent={openEdit}
        onGradeChange={updateGradeField}
      />

      <AssignmentPanel
        course={course}
        assignments={courseAssignments}
        roster={roster}
        onCreate={() => setAssignmentDraft({ title: '', due: '', description: '' })}
        onRemove={(id) => void removeAssignment(id)}
        onToggleReviewed={toggleReviewed}
      />

      <StudentDialogs
        course={course}
        studentDraft={studentDraft}
        assignmentDraft={assignmentDraft}
        importText={importText}
        onStudentDraftChange={setStudentDraft}
        onAssignmentDraftChange={setAssignmentDraft}
        onImportTextChange={setImportText}
        onSaveStudent={saveStudent}
        onRemoveStudent={(id) => void removeStudent(id)}
        onSaveAssignment={saveAssignment}
        onImportRoster={importRoster}
      />
    </section>
  )
}
