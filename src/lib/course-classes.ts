import type { Course, CourseClassGroup } from '../data/types'

export function ensureCourseClasses(course: Course): CourseClassGroup[] {
  if (course.classes?.length) return course.classes
  return [
    {
      id: `${course.id}-class-1`,
      name: course.className || '待定班级',
      studentCount: course.students,
      currentWeek: course.currentWeek,
      nodes: [],
      performances: [],
    },
  ]
}

export function courseClassLabel(course: Course): string {
  const classes = ensureCourseClasses(course)
  if (classes.length <= 1) return classes[0]?.name || course.className || '待定班级'
  return `${classes[0].name} 等${classes.length}个班`
}

export function courseStudentCount(course: Course): number {
  const classes = course.classes
  if (!classes?.length) return course.students
  return classes.reduce((sum, item) => sum + (item.studentCount || 0), 0)
}

export function classProgressPct(item: CourseClassGroup, totalWeeks: number) {
  const weeks = Math.max(1, totalWeeks)
  return Math.min(100, Math.round((Math.max(0, item.currentWeek) / weeks) * 100))
}
