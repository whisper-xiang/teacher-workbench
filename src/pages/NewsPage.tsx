import type { NewsItem } from '../data/types'
import { notify } from '../lib/notify'

type Props = {
  news: NewsItem[]
  readItems: string[]
  onChangeRead: (ids: string[]) => void
}

export function NewsPage({ news, readItems, onChangeRead }: Props) {
  const openItem = (item: NewsItem) => {
    if (!readItems.includes(item.id)) onChangeRead([...readItems, item.id])
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer')
      notify.success('已打开原始来源')
      return
    }
    notify.success('已标记为已读')
  }

  return (
    <section className="news-page news-page-simple" aria-label="热点资讯">
      <div className="news-list-simple">
        {news.map((item) => {
          const unread = Boolean(item.fresh && !readItems.includes(item.id))
          return (
            <button
              type="button"
              key={item.id}
              className={`news-row${unread ? ' is-unread' : ''}`}
              onClick={() => openItem(item)}
            >
              <span className="news-row-dot" aria-hidden="true" />
              <span className="news-row-body">
                <strong>{item.title}</strong>
                <small>{item.summary}</small>
                <em>
                  {item.source} · {item.date}
                  {item.url ? ' · 查看原文' : ''}
                </em>
              </span>
            </button>
          )
        })}
        {news.length === 0 && <div className="news-empty-simple">暂无资讯</div>}
      </div>
    </section>
  )
}
