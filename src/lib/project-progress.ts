import type { ActivityProject, ResearchProject, WorkMilestone } from '../data/types'

export function milestoneProgress(milestones: WorkMilestone[]) {
  if (!milestones.length) return 0
  return Math.round((milestones.filter((item) => item.done).length / milestones.length) * 100)
}

export function researchClosingProgress(project: ResearchProject) {
  if (project.achievements.length) {
    const done = project.achievements.filter((item) => item.done).length
    return Math.round((done / project.achievements.length) * 100)
  }
  const required = ['立项', '中期', '结题']
  const covered = required.filter((kind) => project.materials.some((item) => item.kind === kind)).length
  if (!covered) return milestoneProgress(project.milestones)
  return Math.round((covered / required.length) * 100)
}

export function activityProgress(project: ActivityProject) {
  const fromMilestones = milestoneProgress(project.milestones)
  if (fromMilestones || project.milestones.length) return fromMilestones
  if (project.status === 'done') return 100
  if (project.status === 'closing') return 70
  if (project.status === 'doing') return 40
  return 10
}
