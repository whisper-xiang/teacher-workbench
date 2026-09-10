import { useState } from 'react'
import type { Course } from '../data/types'
import { courseClassLabel, ensureCourseClasses } from '../lib/course-classes'
import { currentCourseTopic, formatSession } from '../lib/courses'

type Props = {
  course: Course
  onChangeCourse: (course: Course) => void
  onBack: () => void
  onEdit: () => void
  onOpenStudents?: () => void
  onOpenResources?: () => void
}

function patchWeek(course: Course, currentWeek: number): Course {
  const week = Math.min(course.totalWeeks, Math.max(1, currentWeek))
  const topic = currentCourseTopic({ ...course, currentWeek: week }) || course.topic
  const classes = ensureCourseClasses(course).map((item, index) =>
    index === 0 ? { ...item, currentWeek: week } : item,
  )
  return {
    ...course,
    currentWeek: week,
    topic,
    progress: Math.round((week / Math.max(1, course.totalWeeks)) * 100),
    classes,
  }
}

function patchTopic(course: Course, week: number, text: string): Course {
  const total = Math.max(1, course.totalWeeks)
  const weeklyTopics = Array.from({ length: total }, (_, index) => course.weeklyTopics?.[index] ?? '')
  weeklyTopics[week - 1] = text
  const topic = weeklyTopics[Math.max(0, course.currentWeek - 1)] || course.topic
  return { ...course, weeklyTopics, topic }
}

export function CourseDetailPanel({
  course,
  onChangeCourse,
  onBack,
  onEdit,
  onOpenStudents,
  onOpenResources,
}: Props) {
  const [topicEdit, setTopicEdit] = useState<{ week: number; text: string } | null>(null)
  const topic = currentCourseTopic(course) || '本周主题未写'
  const weeks = Array.from({ length: Math.max(1, course.totalWeeks) }, (_, index) => index + 1)

  const commitTopic = () => {
    if (!topicEdit) return
    onChangeCourse(patchTopic(course, topicEdit.week, topicEdit.text))
    setTopicEdit(null)
  }

  return (
    <section className="courses-page course-detail-panel" aria-label={`${course.name} 课程档案`}>
      <div className="course-detail-nav">
        <button type="button" className="text-action" onClick={onBack}>
          返回课程
        </button>
        <div className="course-detail-nav-actions">
          {onOpenStudents && (
            <button type="button" className="text-action" onClick={onOpenStudents}>
              学生
            </button>
          )}
          {onOpenResources && (
            <button type="button" className="text-action" onClick={onOpenResources}>
              资源
            </button>
          )}
          <button type="button" className="outline-action" onClick={onEdit}>
            编辑
          </button>
        </div>
      </div>

      <header className="course-dossier-head">
        <p>
          {course.code} {courseClassLabel(course)} · {course.credits} 学分
        </p>
        <h1>{course.name}</h1>
      </header>

      <section className="course-week-hero" aria-label="本周教学">
        <p>第 {course.currentWeek} 周</p>
        <h2>{topic}</h2>
        <div className="course-week-step">
          <button
            type="button"
            className="outline-action"
            disabled={course.currentWeek <= 1}
            onClick={() => onChangeCourse(patchWeek(course, course.currentWeek - 1))}
          >
            上一周
          </button>
          <span>
            {course.currentWeek} / {course.totalWeeks}
          </span>
          <button
            type="button"
            className="outline-action"
            disabled={course.currentWeek >= course.totalWeeks}
            onClick={() => onChangeCourse(patchWeek(course, course.currentWeek + 1))}
          >
            下一周
          </button>
        </div>
      </section>

      <section className="course-dossier-block" aria-label="上课时间">
        <h3>上课</h3>
        {course.sessions.length ? (
          <ul className="course-session-list">
            {course.sessions.map((session, index) => (
              <li key={`${session.day}-${session.section}-${index}`}>{formatSession(session)}</li>
            ))}
          </ul>
        ) : (
          <p className="course-dossier-empty">暂未排课，编辑课程时加上时段。</p>
        )}
      </section>

      <section className="course-dossier-block" aria-label="周教学主题">
        <h3>周计划</h3>
        <ol className="course-syllabus">
          {weeks.map((week) => {
            const current = week === course.currentWeek
            const value = course.weeklyTopics?.[week - 1] ?? ''
            return (
              <li key={week} className={current ? 'is-current' : undefined}>
                <button
                  type="button"
                  className="course-syllabus-week"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => onChangeCourse(patchWeek(course, week))}
                >
                  {week}
                </button>
                <input
                  value={topicEdit?.week === week ? topicEdit.text : value}
                  placeholder="未写主题"
                  aria-label={`第 ${week} 周主题`}
                  onFocus={() => setTopicEdit({ week, text: value })}
                  onChange={(event) => setTopicEdit({ week, text: event.target.value })}
                  onBlur={commitTopic}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                />
              </li>
            )
          })}
        </ol>
      </section>
    </section>
  )
}
