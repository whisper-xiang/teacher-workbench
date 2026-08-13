import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import './routes.css'
import './dashboard.css'
import './icon-overrides.css'
import './overview-overrides.css'
import './calendar.css'
import './courses.css'
import './students.css'
import './resources.css'
import './tools.css'
import './news.css'
import './reminders.css'
import './task-board.css'
import './settings.css'
import './majors.css'
import './theme.css'
/* Must load last so page shell padding/width matches overview */
import './layout-overrides.css'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'
import { alignDataToWeekStart } from './data/store'
import { syncAssignmentDeadlines, syncCourseEvents } from './data/sync'
import type { RouteId } from './data/types'
import { thisMondayIso } from './lib/dates'
import { CalendarPage } from './pages/CalendarPage'
import { CoursesPage } from './pages/CoursesPage'
import { Dashboard } from './pages/Dashboard'
import { NewsPage } from './pages/NewsPage'
import { ResourcesPage } from './pages/ResourcesPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudentsPage } from './pages/StudentsPage'
import { TaskBoardPage } from './pages/TaskBoardPage'
import { ToolsPage } from './pages/ToolsPage'
import { RemindersPage } from './pages/RemindersPage'
import { NotifyHost } from './components/NotifyHost'
import { ConfirmHost } from './components/ConfirmHost'
import { GlobalSearchPanel } from './components/GlobalSearchPanel'
import { AiAssistantPanel } from './components/AiAssistantPanel'
import './components/topbar-tools.css'
import { useReminderScheduler } from './hooks/useReminderScheduler'
import { fetchRssNews } from './lib/rss'

type NavPage = { id: RouteId; label: string; icon: string }

const pages: NavPage[] = [
  { id: 'overview', label: '工作概览', icon: '🏠' },
  { id: 'calendar', label: '日程与值班', icon: '📅' },
  { id: 'tasks', label: '教学看板', icon: '✅' },
  { id: 'reminders', label: '通知提醒', icon: '🔔' },
  { id: 'courses', label: '课程与排课', icon: '📚' },
  { id: 'students', label: '学生与评价', icon: '👥' },
  { id: 'resources', label: '教学资源库', icon: '🗂️' },
  { id: 'news', label: '热点资讯', icon: '📰' },
  { id: 'tools', label: '工具箱', icon: '🧰' },
  { id: 'settings', label: '设置与备份', icon: '⚙️' },
]

const groups = [
  { label: '工作台', ids: ['overview', 'calendar', 'tasks', 'reminders'] as RouteId[] },
  { label: '教学管理', ids: ['courses', 'students', 'resources'] as RouteId[] },
  { label: '资讯与工具', ids: ['news', 'tools', 'settings'] as RouteId[] },
]

const isRouteId = (value: string): value is RouteId => pages.some((page) => page.id === value)

const readLocation = () => {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const route = parts[0] ?? ''
  return {
    activeId: isRouteId(route) ? route : ('overview' as RouteId),
    routeParam: parts[1] ?? '',
  }
}

function useWorkbenchRoute() {
  const [{ activeId, routeParam }, setLocation] = useState(readLocation)

  useEffect(() => {
    const syncRoute = () => setLocation(readLocation())
    window.addEventListener('hashchange', syncRoute)
    if (!window.location.hash || !isRouteId(window.location.hash.replace(/^#\/?/, '').split('/')[0] ?? '')) {
      window.history.replaceState(null, '', '#/overview')
      syncRoute()
    }
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  const navigate = (id: RouteId, param?: string) => {
    const destination = param ? `#/${id}/${param}` : `#/${id}`
    if (window.location.hash !== destination) window.location.hash = destination
  }

  return { activeId, routeParam, navigate }
}

function App() {
  const { activeId, routeParam, navigate } = useWorkbenchRoute()
  const { data, patch, update, reset, exportJson, importJson } = useWorkbenchStore()
  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const active = pages.find((page) => page.id === activeId) ?? pages[0]
  const selectPage = (id: string, param?: string) => {
    navigate(id as RouteId, param)
    setNavOpen(false)
  }

  const fireReminder = useCallback(
    (id: string, firedAt: string) => {
      patch('reminders', (prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'fired' as const, firedAt } : item)),
      )
    },
    [patch],
  )

  useReminderScheduler({
    reminders: data.reminders,
    settings: data.reminderSettings,
    onFire: fireReminder,
  })

  const refreshNews = useCallback(async () => {
    const items = await fetchRssNews()
    if (!items.length) throw new Error('未获取到资讯，请检查网络或稍后重试')
    update((current) => ({
      ...current,
      news: items,
      newsRead: current.newsRead.filter((id) => items.some((item) => item.id === id)),
      newsBookmarks: current.newsBookmarks.filter((id) => items.some((item) => item.id === id)),
      meta: { ...current.meta, newsFetchedAt: new Date().toISOString() },
    }))
  }, [update])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        setAiOpen(false)
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
  }, [])

  return (
    <div className="app-shell">
      <NotifyHost />
      <ConfirmHost />
      <GlobalSearchPanel
        open={searchOpen}
        data={data}
        query={searchQuery}
        onClose={closeSearch}
        onNavigate={(route, param) => navigate(route, param)}
      />
      <AiAssistantPanel open={aiOpen} onClose={() => setAiOpen(false)} />
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
                  id === 'students' ? data.students.filter((s) => s.status !== '正常').length :
                  id === 'reminders' ? data.reminders.filter((r) => r.status === 'pending').length :
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
          <div className="topbar-actions">
            <label className={`topbar-search${searchOpen ? ' is-open' : ''}`}>
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setSearchOpen(true)
                  setAiOpen(false)
                }}
                onFocus={() => {
                  setSearchOpen(true)
                  setAiOpen(false)
                }}
                placeholder="搜索课程、学生、资源、任务、资讯…"
                aria-label="搜索全部内容"
              />
              <kbd>⌘K</kbd>
            </label>
            <button
              type="button"
              className={`topbar-icon-btn topbar-icon-btn--ai${aiOpen ? ' active' : ''}`}
              aria-label="AI 助手"
              title="AI 助手"
              onClick={() => {
                setAiOpen((open) => !open)
                setSearchOpen(false)
              }}
            >
              💬
              <small>AI</small>
            </button>
          </div>
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
            onOpenStudents={(courseId) => selectPage('students', courseId)}
            onChange={(courses) => {
              patch('courses', courses)
              // 闭环A：排课变更自动同步日历课程事件
              patch('events', (prev) => syncCourseEvents(prev, courses, data.meta.weekStart))
            }}
          />
        )}
        {activeId === 'students' && (
          <StudentsPage
            courses={data.courses}
            students={data.students}
            assignments={data.assignments}
            grades={data.grades}
            initialCourseId={routeParam}
            onChangeStudents={(students) => patch('students', students)}
            onChangeGrades={(grades) => patch('grades', grades)}
            onChangeAssignments={(assignments) => {
              patch('assignments', assignments)
              patch('events', (prev) => syncAssignmentDeadlines(prev, assignments))
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
            bookmarks={data.newsBookmarks}
            fetchedAt={data.meta.newsFetchedAt}
            onChangeRead={(newsRead) => patch('newsRead', newsRead)}
            onChangeBookmarks={(newsBookmarks) => patch('newsBookmarks', newsBookmarks)}
            onRefresh={refreshNews}
          />
        )}
        {activeId === 'tools' && (
          <ToolsPage
            tools={data.tools}
            favorites={data.favoriteTools}
            onChangeTools={(tools) => patch('tools', tools)}
            onChangeFavorites={(favoriteTools) => patch('favoriteTools', favoriteTools)}
          />
        )}
        {activeId === 'reminders' && (
          <RemindersPage
            reminders={data.reminders}
            settings={data.reminderSettings}
            onChangeReminders={(reminders) => patch('reminders', reminders)}
            onChangeSettings={(reminderSettings) => patch('reminderSettings', reminderSettings)}
          />
        )}
        {activeId === 'settings' && (
          <SettingsPage
            profile={data.profile}
            meta={data.meta}
            updatedAt={data.updatedAt}
            onSaveProfile={(profile, meta) =>
              update((current) => ({
                ...current,
                profile,
                meta,
                events: syncAssignmentDeadlines(
                  syncCourseEvents(current.events, current.courses, meta.weekStart),
                  current.assignments,
                ),
              }))
            }
            onAlignWeek={() =>
              update((current) =>
                alignDataToWeekStart({ ...current, meta: { ...current.meta, demoBanner: true } }, thisMondayIso()),
              )
            }
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
