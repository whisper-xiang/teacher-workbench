import { useMemo, useState } from 'react'
import { uid } from '../data/store'
import {
  PERFORMANCE_RATINGS,
  type Assignment,
  type Course,
  type CourseClassGroup,
  type HomeworkSubmission,
  type PerformanceRating,
  type StudentPerformance,
  type StudentRecord,
} from '../data/types'
import { notify } from '../lib/notify'
import { formatFileSize, openStoredFile, putResourceFile } from '../lib/resource-files'

type Props = {
  course: Course
  activeClass: CourseClassGroup
  students: StudentRecord[]
  assignments: Assignment[]
  onChangeClass: (patch: Partial<CourseClassGroup>) => void
  onChangeAssignments: (assignments: Assignment[]) => void
  onOpenRoster?: () => void
}

export function CourseStudioPanel({
  course,
  activeClass,
  students,
  assignments,
  onChangeClass,
  onChangeAssignments,
  onOpenRoster,
}: Props) {
  const [tab, setTab] = useState<'表现' | '作业'>('表现')
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? '')
  const [drafts, setDrafts] = useState<Record<string, { rating: PerformanceRating; note: string }>>({})

  const classStudents = useMemo(() => {
    const inClass = students.filter((item) => item.courseId === course.id && item.className === activeClass.name)
    return inClass.length ? inClass : students.filter((item) => item.courseId === course.id)
  }, [students, course.id, activeClass.name])
  const courseAssignments = useMemo(
    () => assignments.filter((item) => item.courseId === course.id),
    [assignments, course.id],
  )
  const assignment = courseAssignments.find((item) => item.id === assignmentId) ?? courseAssignments[0]

  const latestOf = (studentId: string) =>
    [...(activeClass.performances ?? [])]
      .filter((item) => item.studentId === studentId)
      .sort((a, b) => b.week - a.week || b.markedAt.localeCompare(a.markedAt))[0]

  const savePerformance = (student: StudentRecord) => {
    const draft = drafts[student.id] ?? {
      rating: latestOf(student.id)?.rating ?? '良好',
      note: latestOf(student.id)?.note ?? '',
    }
    if (!draft.note.trim()) {
      notify.warning('请填写课堂表现说明')
      return
    }
    const next: StudentPerformance = {
      id: uid('pf'),
      studentId: student.id,
      week: activeClass.currentWeek || course.currentWeek || 1,
      rating: draft.rating,
      note: draft.note.trim(),
      markedAt: new Date().toISOString(),
    }
    onChangeClass({ performances: [next, ...(activeClass.performances ?? [])] })
    notify.success(`已记下 ${student.name} 第 ${next.week} 周表现`)
  }

  const patchAssignment = (id: string, patch: Partial<Assignment>) => {
    onChangeAssignments(assignments.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const addAssignment = () => {
    const next: Assignment = {
      id: uid('asg'),
      courseId: course.id,
      title: `${course.name}第 ${activeClass.currentWeek} 周作业`,
      due: '',
      description: '',
      reviewed: [],
      submissions: [],
      major: course.major,
    }
    onChangeAssignments([next, ...assignments])
    setAssignmentId(next.id)
    notify.success('已新建作业，可收录学生提交并评价')
  }

  const uploadWork = async (student: StudentRecord, file: File) => {
    if (!assignment) return
    const fileId = uid('hw')
    await putResourceFile(fileId, file, file.name)
    const row: HomeworkSubmission = {
      id: uid('sub'),
      studentId: student.id,
      fileId,
      fileName: file.name,
      mimeType: file.type,
      size: formatFileSize(file.size),
      uploadedAt: new Date().toISOString(),
    }
    const submissions = [...(assignment.submissions ?? []).filter((item) => item.studentId !== student.id), row]
    patchAssignment(assignment.id, {
      submissions,
      submitted: submissions.length,
      total: classStudents.length || assignment.total,
    })
    notify.success(`已收录 ${student.name} 的作业`)
  }

  const evaluate = (student: StudentRecord, score: string, comment: string) => {
    if (!assignment) return
    const submissions = (assignment.submissions ?? []).map((item) =>
      item.studentId === student.id
        ? {
            ...item,
            score: Math.max(0, Math.min(100, Number(score) || 0)),
            comment: comment.trim(),
            evaluatedAt: new Date().toISOString(),
          }
        : item,
    )
    const reviewed = assignment.reviewed.includes(student.name)
      ? assignment.reviewed
      : [...assignment.reviewed, student.name]
    patchAssignment(assignment.id, { submissions, reviewed })
    notify.success(`已评价 ${student.name}`)
  }

  return (
    <section className="settings-card course-studio">
      <div className="course-class-head">
        <div>
          <p className="section-label">{activeClass.name}</p>
          <h2>课堂表现与作业评价</h2>
        </div>
        <div className="students-course-tabs" role="tablist">
          <button type="button" className={tab === '表现' ? 'active' : ''} onClick={() => setTab('表现')}>
            课堂表现
          </button>
          <button type="button" className={tab === '作业' ? 'active' : ''} onClick={() => setTab('作业')}>
            作业评价
          </button>
        </div>
      </div>

      {classStudents.length === 0 ? (
        <div className="work-empty-row">
          这个班还没有花名册。
          {onOpenRoster && (
            <button type="button" className="text-action" onClick={onOpenRoster}>
              去导入学生
            </button>
          )}
        </div>
      ) : tab === '表现' ? (
        <ul className="course-studio-list">
          {classStudents.map((student) => {
            const latest = latestOf(student.id)
            const draft = drafts[student.id] ?? { rating: latest?.rating ?? '良好', note: '' }
            return (
              <li key={student.id}>
                <div className="course-studio-name">
                  <strong>{student.name}</strong>
                  <small>
                    {student.number || '无学号'}
                    {latest ? ` · 第 ${latest.week} 周 ${latest.rating}` : ' · 尚未记录'}
                  </small>
                  {latest?.note ? <p>{latest.note}</p> : null}
                </div>
                <select
                  value={draft.rating}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [student.id]: { ...draft, rating: event.target.value as PerformanceRating },
                    }))
                  }
                >
                  {PERFORMANCE_RATINGS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <input
                  value={draft.note}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [student.id]: { ...draft, note: event.target.value } }))
                  }
                  placeholder="如：讨论积极，案例分析完整"
                />
                <button type="button" className="primary-action" onClick={() => savePerformance(student)}>
                  记下
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="course-studio-work">
          <div className="course-studio-work-bar">
            <label>
              选择作业
              <select value={assignment?.id ?? ''} onChange={(event) => setAssignmentId(event.target.value)}>
                {courseAssignments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="outline-action" onClick={addAssignment}>
              ＋ 新作业
            </button>
          </div>
          {!assignment ? (
            <div className="work-empty-row">先发布一项作业，再收录学生提交的文件并评价。</div>
          ) : (
            <ul className="course-studio-list">
              {classStudents.map((student) => (
                <HomeworkRow
                  key={`${assignment.id}-${student.id}`}
                  student={student}
                  assignment={assignment}
                  onUpload={(file) => void uploadWork(student, file).catch((error: Error) => notify.error(error.message))}
                  onEvaluate={(score, comment) => evaluate(student, score, comment)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function HomeworkRow({
  student,
  assignment,
  onUpload,
  onEvaluate,
}: {
  student: StudentRecord
  assignment: Assignment
  onUpload: (file: File) => void
  onEvaluate: (score: string, comment: string) => void
}) {
  const submission = assignment.submissions?.find((item) => item.studentId === student.id)
  const [score, setScore] = useState(String(submission?.score ?? ''))
  const [comment, setComment] = useState(submission?.comment ?? '')

  return (
    <li className="course-hw-row">
      <div className="course-studio-name">
        <strong>{student.name}</strong>
        <small>
          {submission?.fileName ? `已交 ${submission.fileName}` : '尚未收录作业'}
          {submission?.evaluatedAt ? ` · ${submission.score} 分` : ''}
        </small>
      </div>
      <label className="outline-action course-hw-upload">
        {submission?.fileId ? '更换文件' : '收录作业'}
        <input
          type="file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
            event.target.value = ''
          }}
        />
      </label>
      {submission?.fileId && (
        <button type="button" className="text-action" onClick={() => void openStoredFile(submission.fileId!)}>
          预览
        </button>
      )}
      <input value={score} onChange={(event) => setScore(event.target.value)} placeholder="分数" inputMode="numeric" />
      <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="评语" />
      <button type="button" className="primary-action" onClick={() => onEvaluate(score, comment)} disabled={!submission}>
        评价
      </button>
    </li>
  )
}
