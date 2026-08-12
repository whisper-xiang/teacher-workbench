import type { MajorId } from '../data/types'

export function MajorTag({ major, compact = false }: { major?: MajorId | null; compact?: boolean }) {
  if (!major) return <span className="major-tag major-general">{compact ? '通' : '通用'}</span>
  const map = {
    edu: { label: compact ? '教育' : '教育学', cls: 'major-edu' },
    pri: { label: compact ? '小教' : '小学教育', cls: 'major-pri' },
    pre: { label: compact ? '学前' : '学前教育', cls: 'major-pre' },
  } as const
  const item = map[major]
  return <span className={`major-tag ${item.cls}`}>{item.label}</span>
}

export function MajorFilter({
  value,
  onChange,
  includeGeneral = false,
}: {
  value: MajorId | '' | 'general'
  onChange: (value: MajorId | '' | 'general') => void
  includeGeneral?: boolean
}) {
  return (
    <select
      className="major-filter"
      value={value}
      onChange={(e) => onChange(e.target.value as MajorId | '' | 'general')}
      aria-label="按专业筛选"
    >
      <option value="">全部专业</option>
      <option value="edu">教育学</option>
      <option value="pri">小学教育</option>
      <option value="pre">学前教育</option>
      {includeGeneral && <option value="general">通用任务</option>}
    </select>
  )
}
