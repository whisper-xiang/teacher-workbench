import type { Assignment, Course, GradeItem, StudentRecord } from '../../data/types'
import { letterGrade } from '../../data/types'
import { MajorTag } from '../MajorTag'
import { STUDENT_STATUSES } from './student-model'

export type StudentDraft = {
  id: string
  name: string
  number: string
  group: string
  attendance: string
  processScore: string
  status: StudentRecord['status']
  notes: string
  usual: string
  midterm: string
  final: string
}

export type AssignmentDraft = {
  title: string
  due: string
  description: string
}

type StudentRosterTableProps = {
  students: StudentRecord[]
  selectedIds: string[]
  rosterSize: number
  hasCourse: boolean
  gradeFor: (studentId: string) => GradeItem | undefined
  onToggleStudent: (id: string) => void
  onToggleVisible: () => void
  onEditStudent: (student: StudentRecord) => void
  onGradeChange: (student: StudentRecord, field: 'usual' | 'midterm' | 'final', value: number) => void
}

export function StudentRosterTable({
  students,
  selectedIds,
  rosterSize,
  hasCourse,
  gradeFor,
  onToggleStudent,
  onToggleVisible,
  onEditStudent,
  onGradeChange,
}: StudentRosterTableProps) {
  return (
    <div className="students-table-wrap">
      <table className="students-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={students.length > 0 && selectedIds.length === students.length}
                onChange={onToggleVisible}
                aria-label="全选当前列表"
              />
            </th>
            <th>学生</th>
            <th>到勤</th>
            <th>作业</th>
            <th>过程分</th>
            <th>平时</th>
            <th>期中</th>
            <th>期末</th>
            <th>总评</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const grade = gradeFor(student.id)
            const total = grade?.total ?? student.processScore
            const letter = letterGrade(total)
            return (
              <tr key={student.id} className={student.status !== '正常' ? 'is-follow' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(student.id)}
                    onChange={() => onToggleStudent(student.id)}
                    aria-label={`选择 ${student.name}`}
                  />
                </td>
                <td>
                  <button type="button" className="student-name-btn" onClick={() => onEditStudent(student)}>
                    <strong>{student.name}</strong>
                    <small>
                      {student.number || '无学号'} · {student.group}
                    </small>
                  </button>
                </td>
                <td>{student.attendance}</td>
                <td>{student.homework}</td>
                <td>{student.processScore}</td>
                {(['usual', 'midterm', 'final'] as const).map((field) => (
                  <td key={field}>
                    <input
                      className="grade-input"
                      value={field === 'final' ? grade?.[field] || '' : grade?.[field] ?? ''}
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
                <td>
                  <em className={`student-status status-${student.status}`}>{student.status}</em>
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

type AssignmentPanelProps = {
  course?: Course
  assignments: Assignment[]
  roster: StudentRecord[]
  onCreate: () => void
  onRemove: (id: string) => void
  onToggleReviewed: (assignment: Assignment, studentName: string) => void
}

export function AssignmentPanel({ course, assignments, roster, onCreate, onRemove, onToggleReviewed }: AssignmentPanelProps) {
  return (
    <section className="assignment-panel" aria-label="本课作业">
      <div className="assignment-panel-head">
        <div>
          <p className="section-label">作业与批改</p>
          <h2>{course ? `${course.name} · 过程性任务` : '作业'}</h2>
        </div>
        <button type="button" className="outline-action" disabled={!course} onClick={onCreate}>
          ＋ 发布作业
        </button>
      </div>
      {assignments.length === 0 && <p className="students-empty">尚未发布作业。</p>}
      <div className="assignment-list">
        {assignments.map((assignment) => (
          <article className="assignment-card" key={assignment.id}>
            <div className="assignment-card-head">
              <div>
                <strong>{assignment.title}</strong>
                <small>
                  截止 {assignment.due.slice(0, 10) || '未定'} · 已批 {assignment.reviewed.length}/
                  {roster.length || assignment.total || 0}
                </small>
              </div>
              <button type="button" className="text-action" onClick={() => onRemove(assignment.id)}>
                删除
              </button>
            </div>
            {assignment.description && <p>{assignment.description}</p>}
            <div className="assignment-review-chips">
              {roster.map((student) => {
                const done = assignment.reviewed.includes(student.name)
                return (
                  <button
                    key={student.id}
                    type="button"
                    className={done ? 'is-reviewed' : ''}
                    onClick={() => onToggleReviewed(assignment, student.name)}
                  >
                    {done ? '✓ ' : ''}
                    {student.name}
                  </button>
                )
              })}
              {roster.length === 0 && <span>先导入花名册后再批改</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

type StudentDialogsProps = {
  course?: Course
  studentDraft: StudentDraft | null
  assignmentDraft: AssignmentDraft | null
  importText: string | null
  onStudentDraftChange: (draft: StudentDraft | null) => void
  onAssignmentDraftChange: (draft: AssignmentDraft | null) => void
  onImportTextChange: (text: string | null) => void
  onSaveStudent: (event: React.FormEvent) => void
  onRemoveStudent: (id: string) => void
  onSaveAssignment: (event: React.FormEvent) => void
  onImportRoster: () => void
}

export function StudentDialogs({
  course,
  studentDraft,
  assignmentDraft,
  importText,
  onStudentDraftChange,
  onAssignmentDraftChange,
  onImportTextChange,
  onSaveStudent,
  onRemoveStudent,
  onSaveAssignment,
  onImportRoster,
}: StudentDialogsProps) {
  return (
    <>
      {studentDraft && course && (
        <div className="students-modal-backdrop" onMouseDown={() => onStudentDraftChange(null)}>
          <form className="students-composer" onSubmit={onSaveStudent} onMouseDown={(event) => event.stopPropagation()}>
            <div>
              <p className="section-label">{studentDraft.id ? '过程性评价' : '添加学生'}</p>
              <h2>
                {studentDraft.id ? studentDraft.name : course.name}
                {studentDraft.id && <MajorTag major={course.major} compact />}
              </h2>
            </div>
            <label>
              姓名
              <input required autoFocus value={studentDraft.name} onChange={(event) => onStudentDraftChange({ ...studentDraft, name: event.target.value })} />
            </label>
            <div className="composer-grid">
              <label>
                学号
                <input value={studentDraft.number} onChange={(event) => onStudentDraftChange({ ...studentDraft, number: event.target.value })} />
              </label>
              <label>
                小组
                <input value={studentDraft.group} onChange={(event) => onStudentDraftChange({ ...studentDraft, group: event.target.value })} />
              </label>
            </div>
            <div className="composer-grid">
              <label>
                到勤
                <input value={studentDraft.attendance} onChange={(event) => onStudentDraftChange({ ...studentDraft, attendance: event.target.value })} />
              </label>
              <label>
                过程分
                <input value={studentDraft.processScore} onChange={(event) => onStudentDraftChange({ ...studentDraft, processScore: event.target.value })} />
              </label>
            </div>
            <label>
              状态
              <select value={studentDraft.status} onChange={(event) => onStudentDraftChange({ ...studentDraft, status: event.target.value as StudentRecord['status'] })}>
                {STUDENT_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <div className="composer-grid">
              <label>
                平时
                <input value={studentDraft.usual} onChange={(event) => onStudentDraftChange({ ...studentDraft, usual: event.target.value })} />
              </label>
              <label>
                期中
                <input value={studentDraft.midterm} onChange={(event) => onStudentDraftChange({ ...studentDraft, midterm: event.target.value })} />
              </label>
            </div>
            <label>
              期末
              <input value={studentDraft.final} onChange={(event) => onStudentDraftChange({ ...studentDraft, final: event.target.value })} />
            </label>
            <label>
              跟进备注
              <textarea rows={3} value={studentDraft.notes} onChange={(event) => onStudentDraftChange({ ...studentDraft, notes: event.target.value })} />
            </label>
            <div className={`composer-actions${studentDraft.id ? ' composer-actions-split' : ''}`}>
              {studentDraft.id && (
                <button type="button" className="danger-action" onClick={() => onRemoveStudent(studentDraft.id)}>移除</button>
              )}
              <div className="composer-actions-right">
                <button type="button" className="outline-action" onClick={() => onStudentDraftChange(null)}>取消</button>
                <button type="submit" className="primary-action">保存</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {assignmentDraft && (
        <div className="students-modal-backdrop" onMouseDown={() => onAssignmentDraftChange(null)}>
          <form className="students-composer" onSubmit={onSaveAssignment} onMouseDown={(event) => event.stopPropagation()}>
            <div><p className="section-label">发布作业</p><h2>写入本课并同步到日程截止</h2></div>
            <label>
              标题
              <input required autoFocus value={assignmentDraft.title} onChange={(event) => onAssignmentDraftChange({ ...assignmentDraft, title: event.target.value })} />
            </label>
            <label>
              截止日期
              <input type="date" value={assignmentDraft.due} onChange={(event) => onAssignmentDraftChange({ ...assignmentDraft, due: event.target.value })} />
            </label>
            <label>
              说明
              <textarea rows={3} value={assignmentDraft.description} onChange={(event) => onAssignmentDraftChange({ ...assignmentDraft, description: event.target.value })} />
            </label>
            <div className="composer-actions">
              <button type="button" className="outline-action" onClick={() => onAssignmentDraftChange(null)}>取消</button>
              <button type="submit" className="primary-action">发布</button>
            </div>
          </form>
        </div>
      )}

      {importText !== null && (
        <div className="students-modal-backdrop" onMouseDown={() => onImportTextChange(null)}>
          <form
            className="students-composer"
            onSubmit={(event) => { event.preventDefault(); onImportRoster() }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div><p className="section-label">导入花名册</p><h2>粘贴 CSV 或每行一人</h2></div>
            <label>
              名单
              <textarea
                required
                autoFocus
                rows={8}
                value={importText}
                onChange={(event) => onImportTextChange(event.target.value)}
                placeholder={'姓名,学号,小组\n陈思雨,202401020113,第一组'}
              />
            </label>
            <div className="composer-actions">
              <button type="button" className="outline-action" onClick={() => onImportTextChange(null)}>取消</button>
              <button type="submit" className="primary-action">导入</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
