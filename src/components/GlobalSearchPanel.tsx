import { useEffect, useMemo } from 'react'
import type { RouteId, WorkbenchData } from '../data/types'
import { buildSearchIndex, groupSearchResults, searchWorkbench, type SearchResult } from '../lib/global-search'

type Props = {
  open: boolean
  data: WorkbenchData
  query: string
  onClose: () => void
  onNavigate: (route: RouteId, param?: string) => void
}

export function GlobalSearchPanel({ open, data, query, onClose, onNavigate }: Props) {
  const index = useMemo(() => buildSearchIndex(data), [data])
  const results = useMemo(() => searchWorkbench(index, query), [index, query])
  const grouped = useMemo(() => groupSearchResults(results), [results])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const select = (item: SearchResult) => {
    onNavigate(item.route, item.param)
    onClose()
  }

  return (
    <div className="global-search-overlay" onClick={onClose} role="presentation">
      <div
        className="global-search-panel"
        role="dialog"
        aria-modal="true"
        aria-label="搜索结果"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="global-search-body">
          {!query.trim() ? (
            <p className="global-search-hint">输入关键词，搜索工作台中的课程、学生、资源、任务、资讯等</p>
          ) : results.length === 0 ? (
            <p className="global-search-empty">未找到「{query}」相关结果</p>
          ) : (
            [...grouped.entries()].map(([group, items]) => (
              <section key={group} className="global-search-group">
                <h3>{group}</h3>
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => select(item)}>
                        <strong>{item.title}</strong>
                        <span>{item.meta}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
