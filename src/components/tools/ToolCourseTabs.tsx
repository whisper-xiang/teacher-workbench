import type { Course, StudentRecord } from '../../data/types'
import '../course-tabs.css'

type Props = {
  courses: Course[]
  students: StudentRecord[]
  courseId: string
  onChange: (courseId: string) => void
}

export function ToolCourseTabs({ courses, students, courseId, onChange }: Props) {
  if (!courses.length) return null
  return (
    <div className="students-course-tabs" role="tablist" aria-label="选择课程">
      {courses.map((item) => {
        const count = students.filter((student) => student.courseId === item.id).length
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === courseId}
            className={item.id === courseId ? 'active' : ''}
            onClick={() => onChange(item.id)}
          >
            {item.name}
            <small>{count}</small>
          </button>
        )
      })}
    </div>
  )
}
