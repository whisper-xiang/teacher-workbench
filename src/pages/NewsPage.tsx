import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import '../news.css'
import { uid } from '../data/store'
import { MAJORS, type Course, type MajorId, type NewsCustomFeed, type NewsItem } from '../data/types'
import { todayIso } from '../lib/dates'
import {
  guessNewsDeadline,
  isMustRead,
  isNewsUnread,
  looksLikeResearchNews,
  matchesMajorFilter,
  parseRssFeedUrl,
  pickMustRead,
  type NewsMajorFilter,
} from '../lib/news'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'
import { NEWS_PORTALS, RSS_FEEDS, resolveActiveFeeds, type RssFeedConfig, type RssFetchFailure } from '../lib/rss'

const ALL = '全部'
const CATEGORIES = [ALL, '政策通知', '教研动态', '学术活动', '高校动态', 'AI热点', '行业观察'] as const
const VIEWS = [
  { id: 'all', label: '全部' },
  { id: 'must', label: '今日必看' },
  { id: 'saved', label: '收藏' },
] as const

type ViewId = (typeof VIEWS)[number]['id']

type Props = {
  news: NewsItem[]
  readItems: string[]
  bookmarks: string[]
  fetchedAt?: string
  courses: Course[]
  customFeeds: NewsCustomFeed[]
  disabledFeeds: string[]
  initialId?: string
  onChangeRead: (ids: string[]) => void
  onChangeBookmarks: (ids: string[]) => void
  onChangeDisabledFeeds: (ids: string[]) => void
  onAddCustomFeed: (feed: NewsCustomFeed) => void
  onRemoveCustomFeed: (id: string) => void
  onRefresh: (feeds?: RssFeedConfig[]) => Promise<RssFetchFailure[]>
  onAddDeadline: (item: NewsItem, date: string) => void
  onClipJournal: (item: NewsItem, courseId?: string) => void
  onClipResearch: (item: NewsItem) => void
}

const categoryClass = (accent: NewsItem['accent']) => `news-category category-${accent}`

export function NewsPage({
  news,
  readItems,
  bookmarks,
  fetchedAt,
  courses,
  customFeeds,
  disabledFeeds,
  initialId,
  onChangeRead,
  onChangeBookmarks,
  onChangeDisabledFeeds,
  onAddCustomFeed,
  onRemoveCustomFeed,
  onRefresh,
  onAddDeadline,
  onClipJournal,
  onClipResearch,
}: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>(ALL)
  const [source, setSource] = useState<string>(ALL)
  const [view, setView] = useState<ViewId>('all')
  const [majorFilter, setMajorFilter] = useState<NewsMajorFilter>('mine')
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? news[0]?.id ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [managing, setManaging] = useState(false)
  const [failures, setFailures] = useState<RssFetchFailure[]>([])
  const [remindDate, setRemindDate] = useState(todayIso())
  const [courseId, setCourseId] = useState('')
  const [feedName, setFeedName] = useState('')
  const [feedUrl, setFeedUrl] = useState('')
  const autoFetched = useRef(false)

  const activeFeeds = useMemo(() => resolveActiveFeeds(disabledFeeds, customFeeds), [disabledFeeds, customFeeds])
  const enabledSources = useMemo(() => new Set(activeFeeds.map((feed) => feed.name)), [activeFeeds])

  const fetchedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  const unreadCount = news.filter((item) => isNewsUnread(item, readItems)).length
  const pool = useMemo(
    () => news.filter((item) => enabledSources.has(item.source) || bookmarks.includes(item.id)),
    [news, enabledSources, bookmarks],
  )

  const activeCategories = useMemo(
    () => CATEGORIES.filter((item) => item === ALL || pool.some((entry) => entry.category === item)),
    [pool],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pool.filter((item) => {
      if (view === 'must' && !isMustRead(item)) return false
      if (view === 'saved' && !bookmarks.includes(item.id)) return false
      if (category !== ALL && item.category !== category) return false
      if (source !== ALL && item.source !== source) return false
      if (!matchesMajorFilter(item, majorFilter, courses)) return false
      if (!q) return true
      return `${item.title}${item.summary}${item.source}${item.tag}${item.category}`.toLowerCase().includes(q)
    })
  }, [pool, query, category, source, view, bookmarks, majorFilter, courses])

  const mustRead = useMemo(() => pickMustRead(pool, readItems), [pool, readItems])

  const selected = useMemo(() => {
    return visible.find((item) => item.id === selectedId) ?? visible[0] ?? null
  }, [visible, selectedId])

  const markRead = (id: string) => {
    if (!readItems.includes(id)) onChangeRead([...readItems, id])
  }

  const openSource = (item: NewsItem) => {
    markRead(item.id)
    window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  const selectItem = (item: NewsItem) => {
    setSelectedId(item.id)
    markRead(item.id)
    setRemindDate(guessNewsDeadline(item))
  }

  const toggleBookmark = (id: string, event?: MouseEvent) => {
    event?.stopPropagation()
    const saved = bookmarks.includes(id)
    onChangeBookmarks(saved ? bookmarks.filter((item) => item !== id) : [...bookmarks, id])
    notify.success(saved ? '已取消收藏' : '已加入收藏')
  }

  const clearFilters = () => {
    setQuery('')
    setCategory(ALL)
    setSource(ALL)
    setMajorFilter('mine')
    setView('all')
  }

  const refreshNews = async (silent = false) => {
    setRefreshing(true)
    try {
      const nextFailures = await onRefresh(activeFeeds)
      setFailures(nextFailures)
      if (!silent) {
        if (nextFailures.length) notify.warning(`${nextFailures.map((item) => item.name).join('、')} 没拉到，其余已更新`)
        else notify.success('资讯已更新')
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '拉取 RSS 失败')
    } finally {
      setRefreshing(false)
    }
  }

  const refreshNewsRef = useRef(refreshNews)
  refreshNewsRef.current = refreshNews

  const markAllRead = () => {
    const ids = new Set([...readItems, ...pool.filter((item) => isNewsUnread(item, readItems)).map((item) => item.id)])
    onChangeRead([...ids])
    notify.success('未读已清空')
  }

  const addCustomFeed = (event: FormEvent) => {
    event.preventDefault()
    try {
      const url = parseRssFeedUrl(feedUrl)
      const name = feedName.trim() || new URL(url).hostname
      if (customFeeds.some((feed) => feed.url === url) || RSS_FEEDS.some((feed) => feed.url === url)) {
        notify.warning('这个源已经在列表里')
        return
      }
      const feed = { id: uid('feed'), name, url }
      onAddCustomFeed(feed)
      setFeedName('')
      setFeedUrl('')
      notify.success(`已添加「${name}」`)
      setRefreshing(true)
      void onRefresh(resolveActiveFeeds(disabledFeeds, [...customFeeds, feed]))
        .then((nextFailures) => setFailures(nextFailures))
        .finally(() => setRefreshing(false))
    } catch (error) {
      notify.warning(error instanceof Error ? error.message : '无法添加这个源')
    }
  }

  const toggleFeed = (id: string, enabled: boolean) => {
    const next = enabled ? disabledFeeds.filter((item) => item !== id) : [...disabledFeeds, id]
    onChangeDisabledFeeds(next)
    if (enabled) {
      setRefreshing(true)
      void onRefresh(resolveActiveFeeds(next, customFeeds))
        .then((nextFailures) => setFailures(nextFailures))
        .finally(() => setRefreshing(false))
    }
  }

  const removeFeed = async (feed: NewsCustomFeed) => {
    try {
      await confirm.delete(`去掉「${feed.name}」？收藏过的条目还在。`)
    } catch {
      return
    }
    onRemoveCustomFeed(feed.id)
  }

  useEffect(() => {
    if (autoFetched.current) return
    const stale = !fetchedAt || Date.now() - new Date(fetchedAt).getTime() > 6 * 3_600_000
    if (news.length === 0 || stale) {
      autoFetched.current = true
      void refreshNewsRef.current(true)
    }
  }, [news.length, fetchedAt])

  const prevInitialId = useRef(initialId)
  if (initialId && initialId !== prevInitialId.current) {
    prevInitialId.current = initialId
    setSelectedId(initialId)
  }

  const remindForId = useRef<string | null>(null)
  if (selected && selected.id !== remindForId.current) {
    remindForId.current = selected.id
    setRemindDate(guessNewsDeadline(selected))
  }

  const isEmpty = pool.length === 0
  const isFilteredEmpty = !isEmpty && visible.length === 0
  const filtersActive =
    query.trim() !== '' || category !== ALL || source !== ALL || majorFilter !== 'mine' || view !== 'all'

  return (
    <section className="news-page" aria-label="热点资讯">
      <div className="news-heading">
        <div>
          <p className="section-label">资讯与参考</p>
          <h1>热点资讯</h1>
          <p>
            政策、课标与教研 · 点开先看摘要
            {fetchedLabel ? ` · 上次更新 ${fetchedLabel}` : ''}
            {unreadCount ? ` · ${unreadCount} 条未读` : ''}
          </p>
        </div>
        <div className="news-heading-actions">
          {unreadCount > 0 && (
            <button type="button" className="text-action" onClick={markAllRead}>
              全部标已读
            </button>
          )}
          <button type="button" className="outline-action" onClick={() => setManaging((open) => !open)}>
            {managing ? '收起源' : '管理源'}
          </button>
          <button type="button" className="primary-action news-refresh" disabled={refreshing} onClick={() => refreshNews()}>
            {refreshing ? '拉取中…' : '刷新'}
          </button>
        </div>
      </div>

      {failures.length > 0 && (
        <div className="news-notice">
          <span>
            {failures.map((item) => item.name).join('、')} 这次没拉到，其余源仍可用。
          </span>
        </div>
      )}

      {managing && (
        <div className="news-manage">
          <p className="section-label">订阅源</p>
          <div className="news-manage-list">
            {RSS_FEEDS.map((feed) => {
              const on = !disabledFeeds.includes(feed.id)
              return (
                <label key={feed.id} className="news-manage-row">
                  <input type="checkbox" checked={on} onChange={(event) => toggleFeed(feed.id, event.target.checked)} />
                  <span>{feed.name}</span>
                </label>
              )
            })}
            {customFeeds.map((feed) => {
              const on = !disabledFeeds.includes(feed.id)
              return (
                <label key={feed.id} className="news-manage-row">
                  <input type="checkbox" checked={on} onChange={(event) => toggleFeed(feed.id, event.target.checked)} />
                  <span>{feed.name}</span>
                  <button type="button" className="text-action" onClick={() => void removeFeed(feed)}>
                    去掉
                  </button>
                </label>
              )
            })}
          </div>
          <form className="news-manage-form" onSubmit={addCustomFeed}>
            <input value={feedName} onChange={(event) => setFeedName(event.target.value)} placeholder="源名称，可空" aria-label="自订源名称" />
            <input
              value={feedUrl}
              onChange={(event) => setFeedUrl(event.target.value)}
              placeholder="https:// 学院通知或期刊 RSS"
              aria-label="自订 RSS 地址"
              required
            />
            <button type="submit" className="outline-action">
              添加源
            </button>
          </form>
          <div className="news-sources" aria-label="官网入口">
            {NEWS_PORTALS.map((portal) => (
              <a key={portal.id} href={portal.url} target="_blank" rel="noopener noreferrer" title={portal.note}>
                {portal.name}
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="news-workspace">
        <div className="news-col">
          <div className="news-toolbar">
            <label className="news-search">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索资讯"
                aria-label="搜索资讯"
                disabled={isEmpty}
              />
            </label>
            <div className="news-filters news-views" role="tablist" aria-label="列表范围">
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={view === item.id}
                  className={view === item.id ? 'active' : ''}
                  onClick={() => setView(item.id)}
                >
                  {item.id === 'saved' ? `${item.label} ${bookmarks.length}` : item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="news-refine">
            <div className="news-filters news-major-filters" role="tablist" aria-label="按专业">
              <button type="button" className={majorFilter === 'mine' ? 'active' : ''} onClick={() => setMajorFilter('mine')}>
                与我相关
              </button>
              {MAJORS.map((major) => (
                <button
                  key={major.id}
                  type="button"
                  className={majorFilter === major.id ? 'active' : ''}
                  onClick={() => setMajorFilter(major.id)}
                >
                  {major.short}
                </button>
              ))}
              <button type="button" className={majorFilter === 'all' ? 'active' : ''} onClick={() => setMajorFilter('all')}>
                全部
              </button>
            </div>
            <label className="news-refine-field">
              分类
              <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={isEmpty} aria-label="分类">
                {activeCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="news-refine-field">
              来源
              <select value={source} onChange={(event) => setSource(event.target.value)} disabled={isEmpty} aria-label="来源">
                <option value={ALL}>全部源</option>
                {activeFeeds.map((feed) => (
                  <option key={feed.id} value={feed.name}>
                    {feed.name}
                  </option>
                ))}
              </select>
            </label>
            {filtersActive && (
              <button type="button" className="text-action news-refine-clear" onClick={clearFilters}>
                清除
              </button>
            )}
          </div>

          {view === 'all' && mustRead.length > 0 && (
            <button type="button" className="news-must-link" onClick={() => setView('must')}>
              今日必看 {mustRead.length} 条
            </button>
          )}

          <div className="news-feed">
            <div className="news-feed-head">
              <h2>{view === 'saved' ? '收藏' : view === 'must' ? '今日必看' : '资讯'}</h2>
              <span>{visible.length} 条</span>
            </div>

            {isEmpty ? (
              <div className="news-empty">
                <h3>{refreshing ? '正在拉取 RSS 资讯…' : '没拉到资讯'}</h3>
                <p>{refreshing ? '第一次打开会自动取最新内容' : '检查网络后再试'}</p>
                {!refreshing && (
                  <button type="button" className="text-action" onClick={() => refreshNews()}>
                    重新拉取
                  </button>
                )}
              </div>
            ) : isFilteredEmpty ? (
              <div className="news-empty">
                <h3>{view === 'must' ? '这两天没有必须盯的政策或征稿' : view === 'saved' ? '还没有收藏' : '没有匹配的资讯'}</h3>
                <p>{view === 'saved' ? '点列表右侧星星即可留下' : '试试调整搜索、专业或分类'}</p>
                {view !== 'saved' && (
                  <button type="button" className="text-action" onClick={clearFilters}>
                    清除筛选
                  </button>
                )}
              </div>
            ) : (
              <div className="news-list">
                {visible.map((item) => {
                  const unread = isNewsUnread(item, readItems)
                  const isSelected = selected?.id === item.id
                  const saved = bookmarks.includes(item.id)
                  return (
                    <article key={item.url || item.id} className={`news-card${isSelected ? ' selected' : ''}${unread ? ' is-unread' : ''}`}>
                      {unread && <span className="news-unread" aria-label="未读" />}
                      <button
                        type="button"
                        className="news-card-main"
                        onClick={() => selectItem(item)}
                        aria-pressed={isSelected}
                        aria-label={item.title}
                      >
                        <h3>{item.title}</h3>
                        <p>{item.summary}</p>
                        <div>
                          <span>{item.source}</span>
                          <span>{item.date}</span>
                          <span>{item.category}</span>
                          {item.hot && <span className="news-hot">新</span>}
                          {itemMajorsLabel(item)}
                        </div>
                      </button>
                      <button
                        type="button"
                        className={`bookmark-toggle${saved ? ' saved' : ''}`}
                        aria-label={saved ? '取消收藏' : '收藏'}
                        onClick={(event) => toggleBookmark(item.id, event)}
                      >
                        {saved ? '★' : '☆'}
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="news-detail">
          {selected ? (
            <>
              <div className="news-detail-top">
                <span className={categoryClass(selected.accent)}>{selected.category}</span>
                <button
                  type="button"
                  className={`bookmark-toggle${bookmarks.includes(selected.id) ? ' saved' : ''}`}
                  aria-label={bookmarks.includes(selected.id) ? '取消收藏' : '收藏'}
                  onClick={() => toggleBookmark(selected.id)}
                >
                  {bookmarks.includes(selected.id) ? '★' : '☆'}
                </button>
              </div>
              <h2>{selected.title}</h2>
              <div className="news-detail-meta">
                <span>{selected.source}</span>
                <span>{selected.date}</span>
                <span>{selected.tag}</span>
                {itemMajorsLabel(selected)}
              </div>
              <p>{selected.summary}</p>
              <button type="button" className="primary-action news-source-action" onClick={() => openSource(selected)}>
                打开原文
              </button>

              <div className="news-actions">
                <p className="section-label">用到工作台</p>
                <div className="news-action-row">
                  <input
                    type="date"
                    value={remindDate}
                    onChange={(event) => setRemindDate(event.target.value)}
                    aria-label="日程日期"
                  />
                  <button type="button" className="outline-action" onClick={() => onAddDeadline(selected, remindDate)}>
                    加到日程
                  </button>
                </div>
                <div className="news-action-row">
                  <select value={courseId} onChange={(event) => setCourseId(event.target.value)} aria-label="关联课程">
                    <option value="">不指定课程</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="outline-action" onClick={() => onClipJournal(selected, courseId || undefined)}>
                    剪藏到随手记
                  </button>
                </div>
                {looksLikeResearchNews(selected) && (
                  <button type="button" className="outline-action news-research-action" onClick={() => onClipResearch(selected)}>
                    收入科研
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="news-empty">
              <h3>{refreshing ? '加载中…' : '暂无预览'}</h3>
              <p>{refreshing ? '正在从 RSS 源拉取资讯' : '拉取完成后点左侧条目看摘要'}</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

function itemMajorsLabel(item: NewsItem) {
  const ids = item.majors ?? []
  if (!ids.length) return null
  const names = ids
    .map((id: MajorId) => MAJORS.find((major) => major.id === id)?.short)
    .filter(Boolean)
    .join(' / ')
  return names ? <span>{names}</span> : null
}
