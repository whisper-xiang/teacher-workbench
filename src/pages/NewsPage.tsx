import { useState } from 'react'
import { ArrowUpRightRegular, BookmarkRegular, FilterRegular, SearchRegular } from '../icons'
import type { NewsItem } from '../data/types'
import { notify } from '../lib/notify'

type Props = {
  news: NewsItem[]
  bookmarks: string[]
  readItems: string[]
  onChangeBookmarks: (ids: string[]) => void
  onChangeRead: (ids: string[]) => void
}

export function NewsPage({ news, bookmarks, readItems, onChangeBookmarks, onChangeRead }: Props) {
  const [category, setCategory] = useState<'全部' | NewsItem['category'] | '收藏'>('全部')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(news[0]?.id ?? '')

  const visibleItems = news.filter(
    (item) => (category === '全部' || item.category === category) && `${item.title}${item.summary}${item.tag}`.includes(query.trim()),
  )
  const selected = news.find((item) => item.id === selectedId) ?? visibleItems[0] ?? news[0]

  const toggleBookmark = (id: string) =>
    onChangeBookmarks(bookmarks.includes(id) ? bookmarks.filter((item) => item !== id) : [...bookmarks, id])

  const openItem = (id: string) => {
    setSelectedId(id)
    if (!readItems.includes(id)) onChangeRead([...readItems, id])
  }

  if (!selected) return <section className="news-page"><p>暂无资讯。</p></section>

  return (
    <section className="news-page" aria-label="热点资讯">
      <div className="page-actions">
        <button className="outline-action news-refresh" onClick={() => notify.success('本地资讯清单已刷新显示')}>
          更新清单
        </button>
      </div>
      <div className="news-overview">
        <div>
          <span>本周收录</span>
          <strong>{news.length}</strong>
          <small>条已整理信息</small>
        </div>
        <div>
          <span>未读</span>
          <strong>{news.filter((item) => item.fresh && !readItems.includes(item.id)).length}</strong>
          <small>条待查看</small>
        </div>
        <div>
          <span>我的收藏</span>
          <strong>{bookmarks.length}</strong>
          <small>条后续跟进</small>
        </div>
      </div>
      <div className="news-toolbar">
        <label className="news-search">
          <SearchRegular />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、摘要或主题" aria-label="搜索资讯" />
        </label>
        <div className="news-filters" role="tablist" aria-label="资讯分类">
          <FilterRegular />
          {(['全部', 'AI热点', '政策通知', '教研动态', '高校动态', '学术活动', '行业观察'] as const).map((item) => (
            <button role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="news-workspace">
        <section className="news-feed" aria-label="资讯列表">
          <div className="news-feed-head">
            <div>
              <h2>{category === '全部' ? '全部资讯' : category}</h2>
              <span>共 {visibleItems.length} 条</span>
            </div>
            <button
              className="text-action"
              onClick={() => {
                onChangeRead(news.map((item) => item.id))
                notify.success('已将当前资讯标记为已读')
              }}
            >
              全部标为已读
            </button>
          </div>
          {visibleItems.length ? (
            <div className="news-list">
              {visibleItems.map((item) => (
                <article className={selected.id === item.id ? 'news-card selected' : 'news-card'} key={item.id}>
                  <button className="news-card-main" onClick={() => openItem(item.id)}>
                    <span className={`news-category category-${item.accent}`}>{item.category}</span>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <div>
                      <span>{item.source}</span>
                      <span>{item.date}</span>
                      <span>{item.tag}</span>
                    </div>
                  </button>
                  <button
                    className={bookmarks.includes(item.id) ? 'bookmark-toggle saved' : 'bookmark-toggle'}
                    onClick={() => toggleBookmark(item.id)}
                    aria-label={bookmarks.includes(item.id) ? `取消收藏 ${item.title}` : `收藏 ${item.title}`}
                  >
                    <BookmarkRegular />
                  </button>
                  {item.hot && <span className="news-hot">HOT</span>}
                  {item.fresh && !readItems.includes(item.id) && <i className="news-unread" aria-label="未读" />}
                </article>
              ))}
            </div>
          ) : (
            <div className="news-empty">
              <SearchRegular />
              <h3>没有匹配的资讯</h3>
              <p>试试更换关键词或分类。</p>
              <button
                className="outline-action"
                onClick={() => {
                  setQuery('')
                  setCategory('全部')
                }}
              >
                清除筛选
              </button>
            </div>
          )}
        </section>
        <aside className="news-detail" aria-label="资讯详情">
          <div className="news-detail-top">
            <span className={`news-category category-${selected.accent}`}>{selected.category}</span>
            <button
              className={bookmarks.includes(selected.id) ? 'bookmark-toggle saved' : 'bookmark-toggle'}
              onClick={() => toggleBookmark(selected.id)}
              aria-label="收藏当前资讯"
            >
              <BookmarkRegular />
            </button>
          </div>
          <h2>{selected.title}</h2>
          <div className="news-detail-meta">
            <span>{selected.source}</span>
            <span>{selected.date}</span>
            <span>{selected.tag}</span>
          </div>
          <p>{selected.summary}</p>
          <div className="news-reading-note">
            <p className="section-label">阅读提示</p>
            <span>资讯摘要保存在本地。若有原始链接，请以外站正式发布内容为准。</span>
          </div>
          <button
            className="primary-action news-source-action"
            onClick={() => {
              if (!readItems.includes(selected.id)) onChangeRead([...readItems, selected.id])
              if (selected.url) window.open(selected.url, '_blank', 'noopener,noreferrer')
              notify.success(selected.url ? '已打开原始来源' : '已记录阅读状态')
            }}
          >
            {selected.url ? '查看原始来源' : '标记已读'} <ArrowUpRightRegular />
          </button>
        </aside>
      </div>
    </section>
  )
}
