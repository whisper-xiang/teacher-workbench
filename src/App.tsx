import { useEffect, useState } from 'react'
import './App.css'
import './routes.css'
import './dashboard.css'
import './icon-overrides.css'
import './overview-overrides.css'
import './calendar.css'
import './courses.css'
import './resources.css'
import './tools.css'
import './news.css'
import './task-board.css'
import './settings.css'
import './majors.css'
import './theme.css'
/* Must load last so page shell padding/width matches overview */
import './layout-overrides.css'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'
import { syncCourseEvents } from './data/sync'
import type { RouteId } from './data/types'
import { CalendarPage } from './pages/CalendarPage'
import { CoursesPage } from './pages/CoursesPage'
import { Dashboard } from './pages/Dashboard'
import { NewsPage } from './pages/NewsPage'
import { ResourcesPage } from './pages/ResourcesPage'
import { SettingsPage } from './pages/SettingsPage'
import { TaskBoardPage } from './pages/TaskBoardPage'
import { ToolsPage } from './pages/ToolsPage'
import { NotifyHost } from './components/NotifyHost'

type NavPage = { id: RouteId; label: string; icon: string }

const pages: NavPage[] = [
  { id: 'overview', label: '工作概览', icon: '🏠' },
  { id: 'calendar', label: '日程与值班', icon: '📅' },
  { id: 'tasks', label: '教学看板', icon: '✅' },
  { id: 'courses', label: '课程与排课', icon: '📚' },
  { id: 'resources', label: '教学资源库', icon: '🗂️' },
  { id: 'news', label: '热点资讯', icon: '📰' },
  { id: 'tools', label: '工具箱', icon: '🧰' },
  { id: 'settings', label: '设置与备份', icon: '⚙️' },
]

const groups = [
  { label: '工作台', ids: ['overview', 'calendar', 'tasks'] as RouteId[] },
  { label: '教学管理', ids: ['courses', 'resources'] as RouteId[] },
  { label: '资讯与工具', ids: ['news', 'tools', 'settings'] as RouteId[] },
]

const isRouteId = (value: string): value is RouteId => pages.some((page) => page.id === value)

const readRoute = (): RouteId => {
  const route = window.location.hash.replace(/^#\/?/, '').split('/')[0]
  return isRouteId(route) ? route : 'overview'
}

function useWorkbenchRoute() {
  const [activeId, setActiveId] = useState<RouteId>(readRoute)

  useEffect(() => {
    const syncRoute = () => setActiveId(readRoute())
    window.addEventListener('hashchange', syncRoute)
    if (!window.location.hash || !isRouteId(window.location.hash.replace(/^#\/?/, '').split('/')[0])) {
      window.history.replaceState(null, '', '#/overview')
      syncRoute()
    }
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  const navigate = (id: RouteId) => {
    const destination = `#/${id}`
    if (window.location.hash !== destination) window.location.hash = destination
  }

  return { activeId, navigate }
}

function App() {
  const { activeId, navigate } = useWorkbenchRoute()
  const { data, patch, update, reset, exportJson, importJson } = useWorkbenchStore()
  const [navOpen, setNavOpen] = useState(false)
  const active = pages.find((page) => page.id === activeId) ?? pages[0]
  const selectPage = (id: string) => {
    navigate(id as RouteId)
    setNavOpen(false)
  }

  return (
    <div className="app-shell">
      <NotifyHost />
      <aside className={navOpen ? 'sidebar sidebar-open' : 'sidebar'} aria-label="主导航">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">教</div>
          <div>
            <strong>教学工作台</strong>
            <span>{data.profile.college}教师端 · 本地</span>
          </div>
        </div>
        <nav className="navigation">
          {groups.map((group) => (
            <section className="nav-group" key={group.label} aria-label={group.label}>
              <h2>{group.label}</h2>
              {group.ids.map((id) => {
                const page = pages.find((item) => item.id === id)!
                const selected = id === activeId
                const badge =
                  id === 'tasks' ? data.tasks.filter((t) => t.status !== 'done').length :
                  id === 'news' ? data.news.filter((n) => n.fresh && !data.newsRead.includes(n.id)).length :
                  id === 'calendar' ? data.events.filter((e) => e.kind === 'deadline').length :
                  0
                return (
                  <button className={selected ? 'nav-item nav-item-active' : 'nav-item'} key={id} onClick={() => selectPage(id)}>
                    <span className="nav-icon" aria-hidden="true">{page.icon}</span>
                    <span>{page.label}</span>
                    {badge > 0 && <span className="nav-item-badge">{badge}</span>}
                  </button>
                )
              })}
            </section>
          ))}
        </nav>
        <button className="profile profile-button" onClick={() => selectPage('settings')}>
          <div className="avatar">{data.profile.name.slice(0, 1)}</div>
          <div>
            <strong>{data.profile.name}</strong>
            <span>{data.profile.college} · {data.profile.title}</span>
          </div>
        </button>
      </aside>
      {navOpen && <button className="scrim" onClick={() => setNavOpen(false)} aria-label="关闭菜单" />}
      <main className="main-content">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setNavOpen(true)}>菜单</button>
          <div className="breadcrumb">教学工作台 <span>/</span> {active.label}</div>
          <div className="topbar-note">本地数据 · 可离线使用</div>
        </header>

        {activeId === 'overview' && (
          <Dashboard
            meta={data.meta}
            events={data.events}
            tasks={data.tasks}
            courses={data.courses}
            onNavigate={selectPage}
            onSetTaskStatus={(id, done) =>
              patch('tasks', data.tasks.map((task) => (task.id === id ? { ...task, status: done ? 'done' : 'todo' } : task)))
            }
          />
        )}
        {activeId === 'calendar' && (
          <CalendarPage
            events={data.events}
            dutyConfirmedDates={data.dutyConfirmedDates}
            weekStart={data.meta.weekStart}
            onChangeEvents={(events) => patch('events', events)}
            onToggleDuty={(date) =>
              patch(
                'dutyConfirmedDates',
                data.dutyConfirmedDates.includes(date)
                  ? data.dutyConfirmedDates.filter((item) => item !== date)
                  : [...data.dutyConfirmedDates, date],
              )
            }
          />
        )}
        {activeId === 'tasks' && <TaskBoardPage tasks={data.tasks} onChange={(tasks) => patch('tasks', tasks)} />}
        {activeId === 'courses' && (
          <CoursesPage
            courses={data.courses}
            onChange={(courses) => {
              patch('courses', courses)
              // 闭环A：排课变更自动同步日历课程事件
              patch('events', (prev) => syncCourseEvents(prev, courses, data.meta.weekStart))
            }}
          />
        )}
        {activeId === 'resources' && (
          <ResourcesPage
            resources={data.resources}
            courses={data.courses}
            onChangeResources={(resources) => patch('resources', resources)}
          />
        )}
        {activeId === 'news' && (
          <NewsPage
            news={data.news}
            readItems={data.newsRead}
            onChangeRead={(newsRead) => patch('newsRead', newsRead)}
          />
        )}
        {activeId === 'tools' && (
          <ToolsPage tools={data.tools} onChangeTools={(tools) => patch('tools', tools)} />
        )}
        {activeId === 'settings' && (
          <SettingsPage
            profile={data.profile}
            meta={data.meta}
            updatedAt={data.updatedAt}
            onSaveProfile={(profile, meta) => update((current) => ({ ...current, profile, meta }))}
            onExport={exportJson}
            onImport={importJson}
            onReset={reset}
          />
        )}
      </main>
    </div>
  )
}

export default App
