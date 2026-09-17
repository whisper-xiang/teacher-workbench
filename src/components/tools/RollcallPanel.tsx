import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Course, StudentRecord } from '../../data/types'
import {
  buildSpinSequence,
  copyText,
  formatNamedGroups,
  pickRandom,
  remainingRoster,
  splitBySize,
  splitIntoGroups,
  suggestedGroupCount,
} from '../../lib/classroom-tools'
import { notify } from '../../lib/notify'
import { ToolCourseTabs } from './ToolCourseTabs'

type Mode = 'call' | 'group'
type GroupBy = 'count' | 'size'
type CallPhase = 'idle' | 'spinning' | 'landed' | 'last'

type CallDeck = {
  key: string
  called: StudentRecord[]
  current: StudentRecord | null
  spinning: boolean
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
    called: [],
    current: null,
    spinning: false,
    groupCount: suggestedGroupCount(roster.length),
    groupSize: roster.length <= 4 ? Math.max(1, roster.length) : 4,
    groups: [],
  }
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function sameStudent(a: StudentRecord, b: StudentRecord) {
  return a.id === b.id
}

export function RollcallPanel({ courses, students, onOpenStudents }: Props) {
  const defaultCourseId =
    courses.find((course) => students.some((student) => student.courseId === course.id))?.id ?? courses[0]?.id ?? ''
  const [courseId, setCourseId] = useState(defaultCourseId)
  const [mode, setMode] = useState<Mode>('call')
  const [groupBy, setGroupBy] = useState<GroupBy>('count')
  const [unique, setUnique] = useState(true)
  const [deck, setDeck] = useState<CallDeck>({
    key: '',
    called: [],
    current: null,
    spinning: false,
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

  const called = deck.called
  const current = deck.current
  const spinning = deck.spinning
  const groupCount = deck.groupCount
  const groupSize = deck.groupSize
  const groups = deck.groups
  const pool = unique ? remainingRoster(roster, called) : roster
  const phase: CallPhase = spinning
    ? 'spinning'
    : unique && pool.length === 0 && current
      ? 'last'
      : current
        ? 'landed'
        : 'idle'

  const prevRef = useRef<HTMLParagraphElement>(null)
  const nameRef = useRef<HTMLParagraphElement>(null)
  const nextRef = useRef<HTMLParagraphElement>(null)
  const spinRaf = useRef(0)
  const spinningLock = useRef(false)
  const spinSeq = useRef<StudentRecord[]>([])
  const drawKey = useRef(rosterKey)

  const paintReel = (index: number) => {
    const sequence = spinSeq.current
    const shown = sequence[index]
    if (prevRef.current) prevRef.current.textContent = sequence[index - 1]?.name ?? ''
    if (nameRef.current) nameRef.current.textContent = shown?.name ?? ''
    if (nextRef.current) nextRef.current.textContent = sequence[index + 1]?.name ?? ''
  }

  const cancelSpin = () => {
    cancelAnimationFrame(spinRaf.current)
    spinningLock.current = false
  }

  useEffect(() => {
    cancelSpin()
    drawKey.current = rosterKey
    return () => cancelSpin()
  }, [rosterKey])

  useLayoutEffect(() => {
    if (!spinning) return
    paintReel(0)
  }, [spinning])

  const finishDraw = (winner: StudentRecord, key: string, nextCalled: StudentRecord[]) => {
    spinningLock.current = false
    setDeck((currentDeck) => {
      if (currentDeck.key !== key) return currentDeck
      return {
        ...currentDeck,
        spinning: false,
        current: winner,
        called: nextCalled,
      }
    })
  }

  const startDraw = (replace = false) => {
    if (spinningLock.current || spinning) return
    const existing = replace && current ? called.filter((item) => item.id !== current.id) : called
    const drawPool = unique ? remainingRoster(roster, existing) : roster
    const winner = pickRandom(drawPool)
    if (!winner) return

    const nextCalled = [...existing, winner]
    const key = rosterKey
    cancelAnimationFrame(spinRaf.current)
    spinningLock.current = true

    if (prefersReducedMotion() || drawPool.length <= 1) {
      finishDraw(winner, key, nextCalled)
      return
    }

    const sequence = buildSpinSequence(drawPool, winner, 24, sameStudent)
    spinSeq.current = sequence
    setDeck((currentDeck) => ({
      ...currentDeck,
      spinning: true,
      current: null,
      called: existing,
    }))

    const started = performance.now()
    const duration = 1800
    const tick = (now: number) => {
      if (drawKey.current !== key) {
        spinningLock.current = false
        return
      }
      const t = Math.min(1, (now - started) / duration)
      const eased = 1 - (1 - t) ** 3
      const index = Math.min(sequence.length - 1, Math.floor(eased * sequence.length))
      paintReel(index)
      if (t < 1) {
        spinRaf.current = requestAnimationFrame(tick)
        return
      }
      finishDraw(winner, key, nextCalled)
    }
    spinRaf.current = requestAnimationFrame(tick)
  }

  const restartCall = () => {
    cancelSpin()
    setDeck((currentDeck) => ({
      ...currentDeck,
      called: [],
      current: null,
      spinning: false,
    }))
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

  const kicker =
    phase === 'spinning' ? '签筒转动' : phase === 'last' ? '本轮最后一位' : phase === 'landed' ? '就是这位' : '课堂抽签'

  const stageName = phase === 'landed' || phase === 'last' ? current?.name : '点到谁'
  const stageMeta =
    phase === 'landed' || phase === 'last'
      ? current?.number || '无学号'
      : unique
        ? `还剩 ${pool.length} 人`
        : `花名册 ${roster.length} 人`

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
          <div className={`tools-call-stage is-${phase}`} aria-busy={spinning}>
            <span className="tools-call-seal" aria-hidden="true">
              签
            </span>
            <div className="tools-call-board" aria-live={spinning ? 'off' : 'polite'} aria-atomic="true">
              <p className="tools-call-kicker">
                {kicker}
                {roster.length > 0 ? ` · 已点 ${called.length} / ${roster.length}` : ''}
              </p>
              <div className="tools-call-reel">
                <p ref={prevRef} className="tools-call-reel-item is-prev" aria-hidden="true">
                  {spinning ? '' : '\u00a0'}
                </p>
                <div className="tools-call-window">
                  {spinning ? (
                    <p ref={nameRef} className="tools-call-name is-now" />
                  ) : (
                    <p className={`tools-call-name is-now${phase === 'idle' ? ' is-placeholder' : ''}`}>
                      {stageName}
                    </p>
                  )}
                </div>
                <p ref={nextRef} className="tools-call-reel-item is-next" aria-hidden="true">
                  {spinning ? '' : '\u00a0'}
                </p>
              </div>
              <p className="tools-call-meta">{spinning ? '正在抽取' : stageMeta}</p>
            </div>
          </div>
          <div className="tools-native-actions">
            <button
              type="button"
              className="primary-action"
              disabled={spinning || (unique && pool.length === 0)}
              onClick={() => startDraw(false)}
            >
              {spinning ? '抽取中' : unique && pool.length === 0 ? '本轮已点完' : current ? '再抽一位' : '随机抽取'}
            </button>
            <button type="button" className="outline-action" disabled={spinning || !current} onClick={() => startDraw(true)}>
              这位重抽
            </button>
            <button type="button" className="outline-action" disabled={spinning} onClick={restartCall}>
              重开一轮
            </button>
            <button type="button" className="text-action" disabled={!current || spinning} onClick={() => void copyCurrent()}>
              复制姓名
            </button>
          </div>
          <div className="tools-call-toolbar">
            <button
              type="button"
              className={unique ? 'active' : ''}
              aria-pressed={unique}
              disabled={spinning}
              onClick={() => {
                if (spinning) return
                setUnique((currentUnique) => !currentUnique)
              }}
            >
              本轮不重复
            </button>
            <p className="tools-hint">{unique ? '抽过的人先离开签筒，点完再重开。' : '每次都从全班抽，同一个人可能再被点到。'}</p>
          </div>
          <div className="tools-call-roster" aria-label="花名册">
            {roster.map((item) => {
              const picked = current?.id === item.id
              const wasCalled = called.some((entry) => entry.id === item.id)
              return (
                <span
                  key={item.id}
                  className={`tools-call-chip${picked ? ' is-picked' : wasCalled ? ' is-called' : ''}`}
                >
                  {item.name}
                </span>
              )
            })}
          </div>
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
