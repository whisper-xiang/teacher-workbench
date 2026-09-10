import { useCallback, useEffect, useState } from 'react'
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
import './daily-work.css'
import './interaction.css'
/* Must load last so page shell padding/width matches overview */
import './layout-overrides.css'
import './glass.css'
import './journal.css'
import { useWorkbenchStore } from './hooks/useWorkbenchStore'
import { alignDataToWeekStart, uid } from './data/store'
import { syncDerivedEvents } from './data/sync'
import { inferMajorFromText, type Course, type RouteId } from './data/types'
import type { AssistantDraft } from './lib/assistant'
import { dueLabel, thisMondayIso } from './lib/dates'
import { notify } from './lib/notify'
import { clearAllResourceFiles } from './lib/resource-files'
import { BrandMark } from './components/BrandMark'
import { CalendarPage } from './pages/CalendarPage'
import { CoursesPage } from './pages/CoursesPage'
import { Dashboard } from './pages/Dashboard'
import { NewsPage } from './pages/NewsPage'
import { ResearchPage } from './pages/ResearchPage'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { ResourcesPage } from './pages/ResourcesPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudentsPage } from './pages/StudentsPage'
import { TaskBoardPage } from './pages/TaskBoardPage'
import { ToolsPage } from './pages/ToolsPage'
import { RemindersPage } from './pages/RemindersPage'
import { WorkJournalPanel } from './pages/WorkJournalPanel'
import { DeskPet } from './components/DeskPet'
import { NotifyHost } from './components/NotifyHost'
import { ConfirmHost } from './components/ConfirmHost'
import { GlobalSearchPanel } from './components/GlobalSearchPanel'
import { AiAssistantPanel } from './components/AiAssistantPanel'
import './components/topbar-tools.css'
import { useReminderScheduler } from './hooks/useReminderScheduler'
import { fetchRssNews } from './lib/rss'
import { NavIcon, type IconName } from './nav-icons'

type NavPage = { id: RouteId; label: string; icon: IconName }

const pages: NavPage[] = [
  { id: 'overview', label: '工作概览', icon: 'overview' },
  { id: 'calendar', label: '日程与值班', icon: 'calendar' },
  { id: 'tasks', label: '教学看板', icon: 'tasks' },
  { id: 'journal', label: '随手记', icon: 'journal' },
  { id: 'reminders', label: '通知提醒', icon: 'reminders' },
  { id: 'courses', label: '教学', icon: 'courses' },
  { id: 'research', label: '科研', icon: 'research' },
  { id: 'activities', label: '学生活动', icon: 'activities' },
  { id: 'students', label: '学生与评价', icon: 'students' },
  { id: 'resources', label: '教学资源库', icon: 'resources' },
  { id: 'news', label: '热点资讯', icon: 'news' },
  { id: 'tools', label: '工具箱', icon: 'tools' },
  { id: 'settings', label: '设置与备份', icon: 'settings' },
]

const NAV_COLLAPSED_KEY = 'teacher-workbench-nav-collapsed'

function readNavCollapsed() {
  try {
    return localStorage.getItem(NAV_COLLAPSED_KEY) !== '0'
  } catch {
    return true
  }
}

const groups = [
  { label: '工作台', ids: ['overview', 'calendar', 'journal', 'reminders'] as RouteId[] },
  { label: '日常工作', ids: ['courses', 'students', 'resources', 'research', 'activities'] as RouteId[] },
  { label: '资讯与工具', ids: ['news', 'tools', 'settings'] as RouteId[] },
]

const isRouteId = (value: string): value is RouteId => pages.some((page) => page.id === value)

const readLocation = () => {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const route = parts[0] ?? ''
  if (route === 'courses' && parts[1] === 'journal') {
    return { activeId: 'journal' as RouteId, routeParam: '' }
  }
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
    if (window.location.hash === '#/courses/journal') {
      window.history.replaceState(null, '', '#/journal')
      syncRoute()
    } else if (!window.location.hash || !isRouteId(window.location.hash.replace(/^#\/?/, '').split('/')[0] ?? '')) {
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
  const [navCollapsed, setNavCollapsed] = useState(readNavCollapsed)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [aiOpen, setAiOpen] = useState(false)

  const toggleNavCollapsed = () => {
    setNavCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(NAV_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore quota / private mode */
      }
      return next
    })
  }
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

  const commitAssistant = useCallback(
    (draft: AssistantDraft) => {
      let message = '已写入本机。'
      update((current) => {
        if (draft.kind === 'reminder') {
          const item = {
            id: uid('rem'),
            title: draft.title,
            scheduledAt: draft.scheduledAt,
            status: 'pending' as const,
            source: 'ai' as const,
            rawInput: draft.rawInput,
            createdAt: new Date().toISOString(),
          }
          message = `已写入提醒「${item.title}」，到点会在工作台通知你。`
          notify.success(`已添加提醒「${item.title}」`)
          return { ...current, reminders: [item, ...current.reminders] }
        }

        if (draft.kind === 'course') {
          let courses = current.courses
          if (draft.mode === 'add-session' && draft.existingId) {
            courses = courses.map((course) => {
              if (course.id !== draft.existingId) return course
              const exists = course.sessions.some((item) => item.day === draft.day && item.section === draft.section)
              if (exists) return course
              return { ...course, sessions: [...course.sessions, { day: draft.day, section: draft.section, room: draft.room }] }
            })
            message = `已为「${draft.name}」增加上课时段。`
          } else {
            const next: Course = {
              id: uid('course'),
              name: draft.name,
              code: 'EDU000',
              className: '待定班级',
              students: 40,
              weeks: '第 1–16 周',
              progress: 0,
              status: '待更新',
              color: 'teal',
              major: inferMajorFromText(draft.name),
              credits: 2,
              currentWeek: 1,
              totalWeeks: 16,
              topic: '待补充教学主题',
              sessions: [{ day: draft.day, section: draft.section, room: draft.room }],
              classes: [
                {
                  id: uid('class'),
                  name: '待定班级',
                  studentCount: 40,
                  currentWeek: 1,
                  nodes: [],
                },
              ],
            }
            courses = [...courses, next]
            message = `已新建课程「${draft.name}」，并同步到周课表。`
          }
          notify.success(message)
          return {
            ...current,
            courses,
            events: syncDerivedEvents({ ...current, courses }),
          }
        }

        if (draft.kind === 'resource') {
          const item = {
            id: uid('res'),
            title: draft.title,
            course: draft.course || '未关联课程',
            type: draft.type,
            updated: '刚刚',
            size: '—',
            accent: 'teal',
            description: '由助手登记，可再补传文件。',
            tags: ['助手'],
            format: '其他' as const,
            major: inferMajorFromText(`${draft.course} ${draft.title}`),
          }
          message = `已登记资源「${item.title}」，可到资源库补传文件。`
          notify.success(message)
          return { ...current, resources: [item, ...current.resources] }
        }

        const task = {
          id: uid('task'),
          title: draft.title,
          course: draft.course,
          due: dueLabel(draft.dueDate),
          dueDate: draft.dueDate,
          kind: draft.taskKind,
          status: 'todo' as const,
          priority: 'medium' as const,
          assignee: current.profile.name,
          major: inferMajorFromText(draft.course),
        }
        message = `已在教学看板添加「${task.title}」。`
        notify.success(message)
        return { ...current, tasks: [task, ...current.tasks] }
      })
      return message
    },
    [update],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        setAiOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
  }, [])

  const pendingReminders = data.reminders.filter((item) => item.status === 'pending').length
  const shellClass = [
    'app-shell',
    navCollapsed ? 'nav-collapsed' : '',
    activeId === 'overview' ? 'is-overview' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass}>
      <NotifyHost />
      <ConfirmHost />
      <DeskPet
        greetingName={data.profile.greetingName || `${data.profile.name}老师`}
        pageId={activeId}
        petAvatarId={data.profile.petAvatarId}
        petKind={data.profile.petKind}
      />
      <GlobalSearchPanel
        open={searchOpen}
        data={data}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onClose={closeSearch}
        onNavigate={(route, param) => navigate(route, param)}
      />
      <AiAssistantPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        courses={data.courses}
        onCommit={commitAssistant}
      />
      <aside className={navOpen ? 'sidebar sidebar-open' : 'sidebar'} aria-label="主导航">
        <div className="brand">
          <BrandMark />
          <div className="brand-copy">
            <strong>教学工作台</strong>
            <span>{data.profile.college}教师端 · 本地</span>
          </div>
          <button
            type="button"
            className="nav-collapse"
            onClick={toggleNavCollapsed}
            aria-expanded={!navCollapsed}
            aria-label={navCollapsed ? '展开菜单' : '收起菜单'}
            title={navCollapsed ? '展开菜单' : '收起菜单'}
          >
            <NavIcon name={navCollapsed ? 'expand' : 'collapse'} size={16} />
          </button>
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
                  id === 'calendar' ? data.events.filter((e) => e.kind === 'deadline' && !e.done).length :
                  0
                return (
                  <button
                    className={selected ? 'nav-item nav-item-active' : 'nav-item'}
                    key={id}
                    title={page.label}
                    aria-label={page.label}
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => selectPage(id)}
                  >
                    <span className="nav-icon" aria-hidden="true">
                      <NavIcon name={page.icon} />
                    </span>
                    <span className="nav-item-label">{page.label}</span>
                    {badge > 0 && <span className="nav-item-badge">{badge}</span>}
                  </button>
                )
              })}
            </section>
          ))}
        </nav>
        <button type="button" className="profile profile-button" onClick={() => selectPage('settings')}>
          <div className="avatar">{data.profile.name.slice(0, 1)}</div>
          <div className="profile-copy">
            <strong>{data.profile.name}</strong>
            <span>{data.profile.college} · {data.profile.title}</span>
          </div>
        </button>
      </aside>
      {navOpen && <button className="scrim" onClick={() => setNavOpen(false)} aria-label="关闭菜单" />}
      <main className="main-content">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setNavOpen(true)}>菜单</button>
          {activeId === 'overview' ? (
            <div className="topbar-welcome">
              <span>欢迎回来</span>
              <strong>{data.profile.greetingName}</strong>
            </div>
          ) : (
            <div className="breadcrumb">教学工作台 <span>/</span> {active.label}</div>
          )}
          <div className="topbar-actions">
            <button
              type="button"
              className={`glass-icon-btn${aiOpen ? ' active' : ''}`}
              aria-label="AI 助手"
              title="AI 助手"
              onClick={() => {
                setAiOpen((open) => !open)
                setSearchOpen(false)
              }}
            >
              <NavIcon name="plus" />
            </button>
            <button
              type="button"
              className={`glass-icon-btn${searchOpen ? ' active' : ''}`}
              aria-label="搜索全部内容"
              title="搜索 ⌘K"
              onClick={() => {
                setSearchOpen(true)
                setAiOpen(false)
              }}
            >
              <NavIcon name="search" />
            </button>
            <button
              type="button"
              className="glass-icon-btn"
              aria-label="通知提醒"
              title="通知提醒"
              onClick={() => selectPage('reminders')}
            >
              <NavIcon name="bell" />
              {pendingReminders > 0 && <span className="glass-badge">{pendingReminders}</span>}
            </button>
            <button
              type="button"
              className="glass-icon-btn glass-avatar-btn"
              aria-label="打开设置"
              title={data.profile.name}
              onClick={() => selectPage('settings')}
            >
              <span className="avatar">{data.profile.name.slice(0, 1)}</span>
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
            onSetEventDone={(id, done) =>
              patch(
                'events',
                data.events.map((event) => (event.id === id ? { ...event, done } : event)),
              )
            }
          />
        )}
        {activeId === 'calendar' && (
          <CalendarPage
            events={data.events}
            courses={data.courses}
            weekStart={data.meta.weekStart}
            weekNumber={data.meta.weekNumber}
            onChangeEvents={(events) =>
              update((current) => {
                const previous = new Set(current.events.filter((item) => item.id.startsWith('course-')).map((item) => item.id))
                const nextIds = new Set(events.filter((item) => item.id.startsWith('course-')).map((item) => item.id))
                const removed = [...previous].filter((id) => !nextIds.has(id))
                const hiddenCourseEventIds = [...new Set([...(current.hiddenCourseEventIds ?? []), ...removed])]
                const next = { ...current, events, hiddenCourseEventIds }
                return { ...next, events: syncDerivedEvents(next) }
              })
            }
            onNavigate={(route, param) => selectPage(route, param)}
          />
        )}
        {activeId === 'tasks' && <TaskBoardPage tasks={data.tasks} onChange={(tasks) => patch('tasks', tasks)} />}
        {activeId === 'journal' && (
          <WorkJournalPanel
            notes={data.workNotes}
            onChange={(workNotes) =>
              update((current) => {
                const next = { ...current, workNotes }
                return { ...next, events: syncDerivedEvents(next) }
              })
            }
          />
        )}
        {activeId === 'courses' && (
          <CoursesPage
            courses={data.courses}
            resources={data.resources}
            students={data.students}
            assignments={data.assignments}
            initialCourseId={routeParam}
            onSelectCourse={(courseId) => selectPage('courses', courseId || undefined)}
            onOpenStudents={(courseId) => selectPage('students', courseId)}
            onOpenResources={(courseId) => selectPage('resources', courseId)}
            onChangeResources={(resources) => patch('resources', resources)}
            onChangeAssignments={(assignments) => {
              update((current) => {
                const next = { ...current, assignments }
                return { ...next, events: syncDerivedEvents(next) }
              })
            }}
            onChange={(courses) => {
              update((current) => {
                const next = { ...current, courses }
                return { ...next, events: syncDerivedEvents(next) }
              })
            }}
          />
        )}
        {activeId === 'research' && (
          <ResearchPage
            notices={data.researchNotices}
            projects={data.researchProjects}
            onChangeNotices={(researchNotices) => patch('researchNotices', researchNotices)}
            onChangeProjects={(researchProjects) => patch('researchProjects', researchProjects)}
          />
        )}
        {activeId === 'activities' && (
          <ActivitiesPage
            projects={data.activityProjects}
            onChangeProjects={(activityProjects) => patch('activityProjects', activityProjects)}
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
              update((current) => {
                const next = { ...current, assignments }
                return { ...next, events: syncDerivedEvents(next) }
              })
            }}
            onBack={() => selectPage('courses', routeParam || undefined)}
          />
        )}
        {activeId === 'resources' && (
          <ResourcesPage
            resources={data.resources}
            courses={data.courses}
            initialCourseId={routeParam}
            onOpenCourse={(courseId) => selectPage('courses', courseId)}
            onBack={() => selectPage('courses', routeParam || undefined)}
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
                events: syncDerivedEvents({ ...current, meta }),
              }))
            }
            onAlignWeek={() =>
              update((current) =>
                alignDataToWeekStart({ ...current, meta: { ...current.meta, demoBanner: true } }, thisMondayIso()),
              )
            }
            onExport={exportJson}
            onImport={importJson}
            onReset={() => {
              reset()
              void clearAllResourceFiles()
            }}
          />
        )}
      </main>
    </div>
  )
}

export default App
