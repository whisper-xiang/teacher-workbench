import { useMemo, useState } from 'react'
import type { Course, StudentRecord } from '../../data/types'
import {
  copyText,
  formatNamedGroups,
  shuffled,
  splitBySize,
  splitIntoGroups,
  suggestedGroupCount,
} from '../../lib/classroom-tools'
import { notify } from '../../lib/notify'
import { ToolCourseTabs } from './ToolCourseTabs'

type Mode = 'call' | 'group'
type GroupBy = 'count' | 'size'

type CallDeck = {
  key: string
  queue: StudentRecord[]
  cursor: number
  groupCount: number
  groupSize: number
  groups: StudentRecord[][]
}

type Props = {
  courses: Course[]
  students: StudentRecord[]
  onOpenStudents: (courseId: string) => void
}

function deckFor(key: string, roster: StudentRecord[]): CallDeck {
  return {
    key,
    queue: shuffled(roster),
    cursor: 0,
    groupCount: suggestedGroupCount(roster.length),
    groupSize: roster.length <= 4 ? Math.max(1, roster.length) : 4,
    groups: [],
  }
}

export function RollcallPanel({ courses, students, onOpenStudents }: Props) {
  const defaultCourseId =
    courses.find((course) => students.some((student) => student.courseId === course.id))?.id ?? courses[0]?.id ?? ''
  const [courseId, setCourseId] = useState(defaultCourseId)
  const [mode, setMode] = useState<Mode>('call')
  const [groupBy, setGroupBy] = useState<GroupBy>('count')
  const [deck, setDeck] = useState<CallDeck>({
    key: '',
    queue: [],
    cursor: 0,
    groupCount: 4,
    groupSize: 4,
    groups: [],
  })

  const course = courses.find((item) => item.id === courseId) ?? courses[0]
  const activeCourseId = course?.id ?? ''
  const roster = useMemo(
    () => students.filter((item) => item.courseId === activeCourseId),
    [students, activeCourseId],
  )
  const rosterKey = `${activeCourseId}:${roster.map((item) => item.id).join(',')}`

  if (deck.key !== rosterKey) {
    setDeck(deckFor(rosterKey, roster))
  }

  const queue = deck.queue
  const cursor = deck.cursor
  const groupCount = deck.groupCount
  const groupSize = deck.groupSize
  const groups = deck.groups
  const current = queue[cursor]
  const called = queue.slice(0, cursor)
  const remaining = Math.max(0, queue.length - cursor)

  const restartCall = () => {
    setDeck((currentDeck) => ({
      ...currentDeck,
      queue: shuffled(roster),
      cursor: 0,
    }))
  }

  const nextCall = () => {
    if (cursor < queue.length) {
      setDeck((currentDeck) => ({ ...currentDeck, cursor: currentDeck.cursor + 1 }))
    }
  }

  const runGroups = () => {
    const next = groupBy === 'count' ? splitIntoGroups(roster, groupCount) : splitBySize(roster, groupSize)
    setDeck((currentDeck) => ({ ...currentDeck, groups: next }))
    if (!next.length) notify.info('这门课还没有花名册')
  }

  const copyGroups = async () => {
    if (!groups.length) return
    try {
      await copyText(formatNamedGroups(groups))
      notify.success('已复制分组名单')
    } catch {
      notify.warning('复制失败，请手动选择文字')
    }
  }

  const copyCurrent = async () => {
    if (!current) return
    try {
      await copyText(current.name)
      notify.success(`已复制「${current.name}」`)
    } catch {
      notify.warning('复制失败')
    }
  }

  if (!courses.length) {
    return (
      <div className="tools-empty">
        <h3>还没有课程</h3>
        <p>先在教学页排课，再回来用花名册点名。</p>
      </div>
    )
  }

  return (
    <div className="tools-native-body">
      <ToolCourseTabs courses={courses} students={students} courseId={activeCourseId} onChange={setCourseId} />

      <div className="tools-mode-switch" role="tablist" aria-label="点名或分组">
        <button type="button" role="tab" aria-selected={mode === 'call'} className={mode === 'call' ? 'active' : ''} onClick={() => setMode('call')}>
          点名
        </button>
        <button type="button" role="tab" aria-selected={mode === 'group'} className={mode === 'group' ? 'active' : ''} onClick={() => setMode('group')}>
          分组
        </button>
      </div>

      {roster.length === 0 ? (
        <div className="tools-empty">
          <h3>这门课还没有花名册</h3>
          <p>导入名单后才能点名或分组。</p>
          <button type="button" className="text-action" onClick={() => onOpenStudents(activeCourseId)}>
            去学生页导入
          </button>
        </div>
      ) : mode === 'call' ? (
        <div className="tools-call">
          {current ? (
            <div className="tools-call-stage">
              <p className="tools-call-kicker">
                第 {cursor + 1} 位 · 还剩 {remaining} 人
              </p>
              <p className="tools-call-name">{current.name}</p>
              <p className="tools-call-meta">{current.number || '无学号'}</p>
            </div>
          ) : (
            <div className="tools-call-stage is-done">
              <p className="tools-call-kicker">本轮已点完</p>
              <p className="tools-call-name">全班 {queue.length} 人</p>
              <p className="tools-call-meta">重新开始会再打乱一次顺序</p>
            </div>
          )}
          <div className="tools-native-actions">
            <button type="button" className="primary-action" disabled={!current} onClick={nextCall}>
              下一位
            </button>
            <button type="button" className="outline-action" onClick={restartCall}>
              重新开始
            </button>
            <button type="button" className="text-action" disabled={!current} onClick={() => void copyCurrent()}>
              复制姓名
            </button>
          </div>
          {called.length > 0 && (
            <p className="tools-call-history">
              已点 {called.length} 人：{called.map((item) => item.name).join('、')}
            </p>
          )}
        </div>
      ) : (
        <div className="tools-groups">
          <div className="tools-group-controls">
            <div className="tools-mode-switch" role="radiogroup" aria-label="分组方式">
              <button
                type="button"
                role="radio"
                aria-checked={groupBy === 'count'}
                className={groupBy === 'count' ? 'active' : ''}
                onClick={() => setGroupBy('count')}
              >
                按组数
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={groupBy === 'size'}
                className={groupBy === 'size' ? 'active' : ''}
                onClick={() => setGroupBy('size')}
              >
                按每组人数
              </button>
            </div>
            <label>
              {groupBy === 'count' ? '分成几组' : '每组几人'}
              <input
                type="number"
                min={1}
                max={roster.length}
                value={groupBy === 'count' ? groupCount : groupSize}
                onChange={(event) => {
                  const value = Number(event.target.value) || 1
                  if (groupBy === 'count') {
                    setDeck((currentDeck) => ({ ...currentDeck, groupCount: value }))
                  } else {
                    setDeck((currentDeck) => ({ ...currentDeck, groupSize: value }))
                  }
                }}
              />
            </label>
            <button type="button" className="primary-action" onClick={runGroups}>
              随机分组
            </button>
            <button type="button" className="outline-action" disabled={!groups.length} onClick={() => void copyGroups()}>
              复制名单
            </button>
          </div>
          {groups.length === 0 ? (
            <p className="tools-hint">按当前花名册打乱后分组，只复制，不写回学生页。</p>
          ) : (
            <div className="tools-group-grid">
              {groups.map((group, index) => (
                <article key={`group-${index}`} className="tools-group-card">
                  <h3>
                    第{index + 1}组 <small>{group.length} 人</small>
                  </h3>
                  <p>{group.map((item) => item.name).join('、')}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
