import type { CalendarEvent, ThesisAdvisee } from '../data/types'

export const PAPER_EVENT_PREFIX = 'paper-'

export function paperEventId(adviseeId: string, date: string) {
  return `${PAPER_EVENT_PREFIX}${adviseeId}-${date}`
}

export function upsertPaperDeadline(events: CalendarEvent[], advisee: ThesisAdvisee, date: string): CalendarEvent[] {
  const kept = events.filter((item) => {
    if (!item.id.startsWith(`${PAPER_EVENT_PREFIX}${advisee.id}`)) return true
    return Boolean(item.done)
  })
  return [
    ...kept,
    {
      id: paperEventId(advisee.id, date),
      date,
      start: 0,
      length: 1,
      title: `看${advisee.name}论文`,
      detail: advisee.topic.trim() || '本科毕业论文',
      kind: 'deadline',
      linkTo: { route: 'papers', param: advisee.id },
    },
  ]
}

export function dropPaperEvents(events: CalendarEvent[], adviseeId: string) {
  return events.filter((item) => !item.id.startsWith(`${PAPER_EVENT_PREFIX}${adviseeId}`))
}
