import { useState } from 'react'
import { AddRegular, ArrowUpRightRegular, FolderRegular, SearchRegular, SettingsRegular, StarFilled, StarRegular } from '../icons'
import { uid } from '../data/store'
import type { ToolItem } from '../data/types'
import { notify } from '../lib/notify'

type Props = {
  tools: ToolItem[]
  favorites: string[]
  onChangeTools: (tools: ToolItem[]) => void
  onChangeFavorites: (ids: string[]) => void
}

export function ToolsPage({ tools, favorites, onChangeTools, onChangeFavorites }: Props) {
  const [category, setCategory] = useState<'全部' | '收藏' | ToolItem['category']>('全部')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  const visibleTools = tools.filter(
    (tool) =>
      (category === '全部' || category === '收藏' ? category !== '收藏' || favorites.includes(tool.id) : tool.category === category) &&
      `${tool.name}${tool.description}`.includes(query.trim()),
  )

  const toggleFavorite = (id: string) =>
    onChangeFavorites(favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id])

  const launch = (tool: ToolItem) => {
    if (tool.url) window.open(tool.url, '_blank', 'noopener,noreferrer')
    notify.success(tool.url ? `已在新标签页打开「${tool.name}」` : `「${tool.name}」已记录为常用入口`)
  }

  return (
    <section className="tools-page" aria-label="工具箱">
      <div className="tools-toolbar">
        <div className="tool-categories" role="tablist" aria-label="工具分类">
          {(['全部', '收藏', '备课工具', '教学平台', '学术工具', '效率工具', 'AI工具'] as const).map((item) => (
            <button key={item} role="tab" aria-selected={category === item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>
              {item}
              {item === '收藏' && <span>{favorites.length}</span>}
            </button>
          ))}
        </div>
        <label className="tools-search">
          <SearchRegular />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工具" aria-label="搜索工具" />
        </label>
      </div>
      <div className="tools-summary">
        <div>
          <p className="section-label">{category === '全部' ? '全部工具' : category}</p>
          <h2>{visibleTools.length} 个可用工具</h2>
        </div>
        <button className="tools-manage" onClick={() => notify.success('工具列表已保存在本机')}>
          <SettingsRegular /> 管理排序
        </button>
        <button className="primary-action" onClick={() => setAdding(true)}>
          <AddRegular /> 添加工具
        </button>
      </div>
      <div className="tools-grid">
        {visibleTools.map((tool) => (
          <article className="tool-card" key={tool.id}>
            <div className={`tool-symbol tool-${tool.tone}`}>{tool.initials}</div>
            <div className="tool-card-head">
              <div>
                <h3>{tool.name}</h3>
                <p>{tool.description}</p>
              </div>
              <button
                className={favorites.includes(tool.id) ? 'tool-favorite is-favorite' : 'tool-favorite'}
                onClick={() => toggleFavorite(tool.id)}
                aria-label={favorites.includes(tool.id) ? `取消收藏 ${tool.name}` : `收藏 ${tool.name}`}
              >
                {favorites.includes(tool.id) ? <StarFilled /> : <StarRegular />}
              </button>
            </div>
            <footer>
              <span>{tool.category}{tool.typeLabel ? ` · ${tool.typeLabel}` : ''}</span>
              <button onClick={() => launch(tool)}>
                打开 <ArrowUpRightRegular />
              </button>
            </footer>
            {tool.tags && tool.tags.length > 0 && (
              <div className="tool-tags">{tool.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            )}
          </article>
        ))}
      </div>
      {visibleTools.length === 0 && (
        <div className="tools-empty">
          <FolderRegular />
          <h2>没有找到匹配的工具</h2>
          <p>试试更换分类或调整搜索关键词。</p>
          <button
            className="outline-action"
            onClick={() => {
              setCategory('全部')
              setQuery('')
            }}
          >
            显示全部工具
          </button>
        </div>
      )}
      {adding && (
        <div className="tools-modal-backdrop" onMouseDown={() => setAdding(false)}>
          <form
            className="tools-composer"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const name = String(form.get('name')).trim()
              const description = String(form.get('description')).trim()
              const toolCategory = String(form.get('category')) as ToolItem['category']
              const url = String(form.get('url') || '').trim()
              onChangeTools([
                ...tools,
                {
                  id: uid('tool'),
                  name,
                  description,
                  category: toolCategory,
                  initials: name.slice(0, 1),
                  tone: 'teal',
                  url: url || undefined,
                },
              ])
              setAdding(false)
              notify.success(`已添加「${name}」到本地工具箱`)
            }}
          >
            <div>
              <p className="section-label">自定义入口</p>
              <h2>添加常用工具</h2>
              <p>工具仅保存在本机工作台中。</p>
            </div>
            <label>
              工具名称
              <input name="name" required autoFocus placeholder="例如：课程云平台" />
            </label>
            <label>
              用途说明
              <input name="description" required placeholder="一句话说明这个工具的用途" />
            </label>
            <label>
              链接（可选）
              <input name="url" type="url" placeholder="https://" />
            </label>
            <label>
              分类
              <select name="category" defaultValue="备课工具">
                <option>备课工具</option>
                <option>教学平台</option>
                <option>学术工具</option>
                <option>效率工具</option>
                <option>AI工具</option>
              </select>
            </label>
            <div className="tools-composer-actions">
              <button type="button" className="outline-action" onClick={() => setAdding(false)}>
                取消
              </button>
              <button type="submit" className="primary-action">
                添加工具
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
