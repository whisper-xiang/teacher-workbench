import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { NewsItem } from '../data/types'
import { RSS_FEEDS } from '../lib/rss'
import { notify } from '../lib/notify'

const ALL = '全部'
const CATEGORIES = [ALL, 'AI热点', '政策通知', '教研动态', '学术活动', '高校动态', '行业观察'] as const

type Props = {
  news: NewsItem[]
  readItems: string[]
  bookmarks: string[]
  fetchedAt?: string
  onChangeRead: (ids: string[]) => void
  onChangeBookmarks: (ids: string[]) => void
  onRefresh: () => Promise<void>
}

const categoryClass = (accent: NewsItem['accent']) => `news-category category-${accent}`

export function NewsPage({ news, readItems, bookmarks, fetchedAt, onChangeRead, onChangeBookmarks, onRefresh }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>(ALL)
  const [selectedId, setSelectedId] = useState<string | null>(news[0]?.id ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const autoFetched = useRef(false)

  const fetchedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  const unreadCount = news.filter((item) => item.fresh && !readItems.includes(item.id)).length
  const categoryCount = new Set(news.map((item) => item.category)).size

  const activeCategories = useMemo(
    () => CATEGORIES.filter((item) => item === ALL || news.some((entry) => entry.category === item)),
    [news],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return news.filter((item) => {
      if (category !== ALL && item.category !== category) return false
      if (!q) return true
      return `${item.title}${item.summary}${item.source}${item.tag}${item.category}`.toLowerCase().includes(q)
    })
  }, [news, query, category])

  const selected = useMemo(() => {
    const current = visible.find((item) => item.id === selectedId)
    return current ?? visible[0] ?? null
  }, [visible, selectedId])

  const markRead = (id: string) => {
    if (!readItems.includes(id)) onChangeRead([...readItems, id])
  }

  const openSource = (item: NewsItem) => {
    markRead(item.id)
    window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  const activateItem = (item: NewsItem) => {
    setSelectedId(item.id)
    openSource(item)
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
  }

  const refreshNews = async (silent = false) => {
    setRefreshing(true)
    try {
      await onRefresh()
      if (!silent) notify.success('资讯已更新')
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '拉取 RSS 失败')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (autoFetched.current || news.length > 0) return
    autoFetched.current = true
    void refreshNews(true)
  }, [news.length])

  useEffect(() => {
    if (news.length && !news.some((item) => item.id === selectedId)) {
      setSelectedId(news[0]?.id ?? null)
    }
  }, [news, selectedId])

  const isEmpty = news.length === 0
  const isFilteredEmpty = !isEmpty && visible.length === 0

  return (
    <section className="news-page" aria-label="热点资讯">
      <div className="news-heading">
        <div>
          <p className="section-label">资讯与参考</p>
          <h1>热点资讯</h1>
          <p>
            教育政策、教研动态与学术活动 · RSS 实时聚合
            {fetchedLabel ? ` · 上次更新 ${fetchedLabel}` : ''}
          </p>
        </div>
        <button type="button" className="primary-action news-refresh" disabled={refreshing} onClick={() => refreshNews()}>
          {refreshing ? '拉取中…' : '↻ 刷新资讯'}
        </button>
      </div>

      <div className="news-notice">
        <span aria-hidden="true">ℹ</span>
        <span>
          资讯来自 {RSS_FEEDS.length} 个 RSS 源（{RSS_FEEDS.map((feed) => feed.name).join('、')}），
          点击条目打开原文；上次拉取结果会缓存在本地。
        </span>
      </div>

      <div className="news-overview">
        <div>
          <span>资讯总数</span>
          <strong>{news.length}</strong>
          <small>涵盖 {categoryCount || RSS_FEEDS.length} 个来源</small>
        </div>
        <div>
          <span>未读提醒</span>
          <strong>{unreadCount}</strong>
          <small>侧边栏同步显示</small>
        </div>
        <div>
          <span>已收藏</span>
          <strong>{bookmarks.length}</strong>
          <small>可快速回看</small>
        </div>
      </div>

      <div className="news-toolbar">
        <label className="news-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、来源或标签"
            aria-label="搜索资讯"
            disabled={isEmpty}
          />
        </label>
        <div className="news-filters" role="tablist" aria-label="分类筛选">
          {activeCategories.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              className={category === item ? 'active' : ''}
              onClick={() => setCategory(item)}
              disabled={isEmpty}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="news-workspace">
        <div className="news-feed">
          <div className="news-feed-head">
            <h2>资讯列表</h2>
            <span>{visible.length} 条</span>
          </div>

          {isEmpty ? (
            <div className="news-empty">
              <span aria-hidden="true">{refreshing ? '⏳' : '📡'}</span>
              <h3>{refreshing ? '正在拉取 RSS 资讯…' : '暂无资讯'}</h3>
              <p>{refreshing ? '首次进入会自动从 RSS 源获取最新内容' : '请检查网络后点击「刷新资讯」'}</p>
              {!refreshing && (
                <button type="button" className="text-action" onClick={() => refreshNews()}>
                  重新拉取
                </button>
              )}
            </div>
          ) : isFilteredEmpty ? (
            <div className="news-empty">
              <span aria-hidden="true">📭</span>
              <h3>没有匹配的资讯</h3>
              <p>试试调整搜索词或分类筛选</p>
              <button type="button" className="text-action" onClick={clearFilters}>
                清除筛选
              </button>
            </div>
          ) : (
            visible.map((item) => {
              const unread = Boolean(item.fresh && !readItems.includes(item.id))
              const isSelected = selected?.id === item.id
              const saved = bookmarks.includes(item.id)
              return (
                <article key={item.id} className={`news-card has-link${isSelected ? ' selected' : ''}`}>
                  {unread && <span className="news-unread" aria-label="未读" />}
                  <button
                    type="button"
                    className="news-card-main"
                    onClick={() => activateItem(item)}
                    aria-label={`${item.title}，打开原文`}
                  >
                    <span className={categoryClass(item.accent)}>{item.category}</span>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <div>
                      <span>{item.source}</span>
                      <span>{item.date}</span>
                      {item.hot && <span>热门</span>}
                      <span>点击阅读原文</span>
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
            })
          )}
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
              <h2>
                <button type="button" className="news-detail-title-link" onClick={() => openSource(selected)}>
                  {selected.title}
                </button>
              </h2>
              <div className="news-detail-meta">
                <span>{selected.source}</span>
                <span>{selected.date}</span>
                <span>{selected.tag}</span>
                {selected.hot && <span>热门</span>}
              </div>
              <p>{selected.summary}</p>
              <div className="news-reading-note">
                <p className="section-label">阅读提示</p>
                <span>点击标题或下方按钮，在新标签页打开 RSS 原文。</span>
              </div>
              <button type="button" className="primary-action news-source-action" onClick={() => openSource(selected)}>
                ↗ 打开原文
              </button>
            </>
          ) : (
            <div className="news-empty">
              <span aria-hidden="true">📰</span>
              <h3>{refreshing ? '加载中…' : '暂无预览'}</h3>
              <p>{refreshing ? '正在从 RSS 源拉取资讯' : '拉取完成后可在此预览摘要'}</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
