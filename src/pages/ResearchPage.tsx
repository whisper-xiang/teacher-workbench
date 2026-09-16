import { useMemo, useState } from 'react'
import '../components/course-tabs.css'
import '../daily-work.css'
import '../research.css'
import { FileIntake } from '../components/FileIntake'
import { StoredFileEditor } from '../components/StoredFileEditor'
import { WorkMaterialsPanel } from '../components/WorkMaterialsPanel'
import { uid } from '../data/store'
import type { ResearchNotice, ResearchProject, WorkMaterial } from '../data/types'
import { fillIfEmpty, guessFromFile } from '../lib/intake-file'
import { notify } from '../lib/notify'
import { formatFileSize, openStoredFile, putResourceFile } from '../lib/resource-files'

type TabId = 'upcoming' | 'open' | 'active' | 'ended'

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: 'upcoming', label: '待开始', hint: '尚未开放' },
  { id: 'open', label: '已开始', hint: '可以申报' },
  { id: 'active', label: '正在进行', hint: '撰写与执行' },
  { id: 'ended', label: '已结束', hint: '最终归档' },
]

const MATERIAL_KINDS = ['项目资料', '正在撰写', '最终版']

type Props = {
  notices: ResearchNotice[]
  projects: ResearchProject[]
  onChangeNotices: (notices: ResearchNotice[]) => void
  onChangeProjects: (projects: ResearchProject[]) => void
  onOpenSettings: () => void
}

const RESEARCH_PRESETS = [
  { title: '教育部人文社会科学研究项目', source: '教育部社科司', category: '教育部' },
  { title: '全国教育科学规划课题', source: '全国教科规划办', category: '教科规划' },
  { title: '陕西省教育科学规划课题', source: '陕西省教育科学研究院', category: '省规划' },
  { title: '陕西省哲学社会科学研究专项', source: '陕西省社科联', category: '省社科' },
  { title: '校级教育教学改革项目', source: '学校教务处', category: '校级教改' },
  { title: '大学生创新创业训练计划', source: '创新创业学院', category: '大创' },
]

const defaultMilestones = () => [
  { id: uid('ms'), name: '开始申报', done: true },
  { id: uid('ms'), name: '材料完成', done: false },
  { id: uid('ms'), name: '完成归档', done: false },
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function stageLabel(project: ResearchProject) {
  if (project.status === 'ended') return '已归档'
  return project.status === 'applying' ? '申报中' : '执行中'
}

export function ResearchPage({
  notices,
  projects,
  onChangeNotices,
  onChangeProjects,
  onOpenSettings,
}: Props) {
  const [tab, setTab] = useState<TabId>('upcoming')
  const [selectedId, setSelectedId] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [projectCategory, setProjectCategory] = useState('校级')
  const [projectSummary, setProjectSummary] = useState('')
  const [noticePreset, setNoticePreset] = useState('')
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeSource, setNoticeSource] = useState('')
  const [noticeCategory, setNoticeCategory] = useState('其他')
  const [noticeOpenAt, setNoticeOpenAt] = useState('')
  const [noticeCloseAt, setNoticeCloseAt] = useState('')
  const [noticeFile, setNoticeFile] = useState<File | null>(null)
  const [noticeBusy, setNoticeBusy] = useState(false)
  const [handlingNoticeId, setHandlingNoticeId] = useState('')

  const selected = projects.find((item) => item.id === selectedId)
  const visibleNotices = useMemo(
    () => notices.filter((item) => item.status === tab),
    [notices, tab],
  )
  const visibleProjects = useMemo(
    () => projects.filter((item) => (tab === 'ended' ? item.status === 'ended' : item.status !== 'ended')),
    [projects, tab],
  )

  const countFor = (id: TabId) => {
    if (id === 'upcoming' || id === 'open') return notices.filter((item) => item.status === id).length
    if (id === 'ended') return projects.filter((item) => item.status === 'ended').length
    return projects.filter((item) => item.status !== 'ended').length
  }

  const patchNotice = (id: string, patch: Partial<ResearchNotice>) => {
    onChangeNotices(notices.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const patchProject = (id: string, patch: Partial<ResearchProject>) => {
    onChangeProjects(projects.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const resetNoticeForm = () => {
    setNoticePreset('')
    setNoticeTitle('')
    setNoticeSource('')
    setNoticeCategory('其他')
    setNoticeOpenAt('')
    setNoticeCloseAt('')
    setNoticeFile(null)
  }

  const applyNoticePreset = (value: string) => {
    setNoticePreset(value)
    const preset = RESEARCH_PRESETS.find((item) => item.title === value)
    if (!preset) return
    setNoticeTitle(preset.title)
    setNoticeSource(preset.source)
    setNoticeCategory(preset.category)
  }

  const applyNoticeFile = async (file: File | null) => {
    setNoticeFile(file)
    if (!file) return
    setNoticeBusy(true)
    try {
      const guess = await guessFromFile(file)
      setNoticeTitle((current) => fillIfEmpty(current, guess.title))
      setNoticeSource((current) => fillIfEmpty(current, guess.source))
      setNoticeCategory((current) => fillIfEmpty(current, guess.category))
      setNoticeOpenAt((current) => fillIfEmpty(current, guess.openAt))
      setNoticeCloseAt((current) => fillIfEmpty(current, guess.closeAt))
      notify.info('已识别名称和日期，仍可手动修改')
    } finally {
      setNoticeBusy(false)
    }
  }

  const addNotice = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!noticeTitle.trim()) {
      notify.warning('请填写项目名称，或先上传通知')
      return
    }
    let fileMeta: Pick<ResearchNotice, 'fileId' | 'fileName' | 'mimeType' | 'size' | 'extractedText'> = {}
    if (noticeFile) {
      const fileId = uid('file')
      try {
        await putResourceFile(fileId, noticeFile, noticeFile.name)
        const guess = await guessFromFile(noticeFile)
        fileMeta = {
          fileId,
          fileName: noticeFile.name,
          mimeType: noticeFile.type,
          size: formatFileSize(noticeFile.size),
          extractedText: guess.extractedText,
        }
      } catch (error) {
        notify.error(error instanceof Error ? error.message : '文件保存失败')
        return
      }
    }
    const next: ResearchNotice = {
      id: uid('rn'),
      title: noticeTitle.trim(),
      source: noticeSource.trim() || '手工录入',
      summary: '',
      category: noticeCategory.trim() || '其他',
      openAt: noticeOpenAt,
      closeAt: noticeCloseAt,
      status: tab === 'open' ? 'open' : 'upcoming',
      ...fileMeta,
    }
    onChangeNotices([next, ...notices])
    resetNoticeForm()
    setShowCreate(false)
    notify.success(`已放入「${tab === 'open' ? '已开始' : '待开始'}」`)
  }

  const startFromNotice = (notice: ResearchNotice) => {
    const material: WorkMaterial | undefined = notice.fileId
      ? {
          id: uid('mat'),
          title: notice.title,
          kind: '项目资料',
          fileId: notice.fileId,
          fileName: notice.fileName,
          mimeType: notice.mimeType,
          size: notice.size,
          updated: '刚刚',
          extractedText: notice.extractedText,
          note: notice.note,
        }
      : undefined
    const next: ResearchProject = {
      id: uid('rp'),
      title: notice.title,
      category: notice.category,
      status: 'applying',
      summary: notice.summary,
      noticeId: notice.id,
      startDate: todayIso(),
      endDate: notice.closeAt,
      milestones: defaultMilestones(),
      materials: material ? [material] : [],
      achievements: [],
    }
    onChangeProjects([next, ...projects])
    onChangeNotices(notices.filter((item) => item.id !== notice.id))
    setTab('active')
    setSelectedId(next.id)
    notify.success(`已开始申报「${notice.title}」`)
  }

  const addProject = (event: React.FormEvent) => {
    event.preventDefault()
    if (!projectTitle.trim()) {
      notify.warning('请填写项目名称')
      return
    }
    const next: ResearchProject = {
      id: uid('rp'),
      title: projectTitle.trim(),
      category: projectCategory.trim() || '其他',
      status: 'applying',
      summary: projectSummary.trim(),
      startDate: todayIso(),
      milestones: defaultMilestones(),
      materials: [],
      achievements: [],
    }
    onChangeProjects([next, ...projects])
    setProjectTitle('')
    setProjectSummary('')
    setShowCreate(false)
    setSelectedId(next.id)
    notify.success(`已新建「${next.title}」`)
  }

  const archiveProject = (project: ResearchProject) => {
    const finalMaterial = project.materials.some(
      (item) => (item.kind === '最终版' || item.kind === '结题') && Boolean(item.fileId || item.extractedText?.trim()),
    )
    if (!finalMaterial) {
      notify.warning('请先添加一份“最终版”材料再归档')
      return
    }
    patchProject(project.id, {
      status: 'ended',
      endDate: todayIso(),
      milestones: project.milestones.map((item) => ({ ...item, done: true })),
    })
    setTab('ended')
    notify.success(`「${project.title}」已归档`)
  }

  const switchTab = (next: TabId) => {
    setTab(next)
    setSelectedId('')
    setShowCreate(false)
    setHandlingNoticeId('')
  }

  const noticeTab = tab === 'upcoming' || tab === 'open'
  const canCreate = tab !== 'ended'

  return (
    <section className="research-page daily-work-page" aria-label="科研项目">
      <header className="research-heading">
        <div>
          <p className="section-label">日常工作 · 科研</p>
          <h1>科研项目</h1>
          <p>从通知收集、材料撰写到最终归档，一条流程完成。</p>
        </div>
        {canCreate && (
          <button type="button" className="primary-action research-add-button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? '收起' : noticeTab ? '＋ 上传通知' : '＋ 新建项目'}
          </button>
        )}
      </header>

      <div className="students-course-tabs research-tabs" role="tablist" aria-label="科研项目状态">
        {TABS.map((item, index) => (
          <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => switchTab(item.id)}>
            <span className="research-tab-index">0{index + 1}</span>
            <span>{item.label}<em>{item.hint}</em></span>
            <small>{countFor(item.id)}</small>
          </button>
        ))}
      </div>

      {showCreate && noticeTab && (
        <form className="daily-create-card research-create-card" onSubmit={(event) => void addNotice(event)}>
          <div>
            <p className="section-label">录入通知</p>
            <h2>上传文件自动识别，也可以直接填写</h2>
          </div>
          <FileIntake file={noticeFile} onFile={(file) => void applyNoticeFile(file)} busy={noticeBusy} label="上传 PDF、Word 或文本通知" />
          <div className="daily-create-grid">
            <label>
              常见申报
              <select value={noticePreset} onChange={(event) => applyNoticePreset(event.target.value)}>
                <option value="">自行填写</option>
                {RESEARCH_PRESETS.map((item) => <option key={item.title}>{item.title}</option>)}
              </select>
            </label>
            <label>项目名称<input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="项目名称" /></label>
            <label>来源<input value={noticeSource} onChange={(event) => setNoticeSource(event.target.value)} placeholder="发布单位" /></label>
            <label>类别<input value={noticeCategory} onChange={(event) => setNoticeCategory(event.target.value)} placeholder="如 省规划" /></label>
            <label>开始日期<input type="date" value={noticeOpenAt} onChange={(event) => setNoticeOpenAt(event.target.value)} /></label>
            <label>截止日期<input type="date" value={noticeCloseAt} onChange={(event) => setNoticeCloseAt(event.target.value)} /></label>
          </div>
          <button className="primary-action" type="submit" disabled={noticeBusy}>保存通知</button>
        </form>
      )}

      {showCreate && tab === 'active' && (
        <form className="daily-create-card research-create-card" onSubmit={addProject}>
          <div><p className="section-label">新建项目</p><h2>创建一个正在申报或执行的项目</h2></div>
          <div className="daily-create-grid">
            <label>项目名称<input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} placeholder="项目名称" /></label>
            <label>类别<input value={projectCategory} onChange={(event) => setProjectCategory(event.target.value)} placeholder="如 校级教改" /></label>
            <label className="daily-create-span">简要说明<input value={projectSummary} onChange={(event) => setProjectSummary(event.target.value)} placeholder="可选" /></label>
          </div>
          <button className="primary-action" type="submit">创建项目</button>
        </form>
      )}

      {noticeTab ? (
        <div className="daily-card-grid research-notice-grid">
          {visibleNotices.map((item) => (
            <article className="daily-card research-notice-card" key={item.id}>
              <div className="research-card-topline">
                <span className="resource-type-pill">{item.category}</span>
                <span className={`research-status-dot is-${tab}`}>{tab === 'upcoming' ? '待开放' : '申报中'}</span>
              </div>
              <h3>{item.title}</h3>
              {item.summary && <p>{item.summary}</p>}
              <dl className="research-notice-meta">
                <div><dt>来源</dt><dd>{item.source}</dd></div>
                <div><dt>{tab === 'upcoming' ? '开始' : '截止'}</dt><dd>{tab === 'upcoming' ? item.openAt || '待定' : item.closeAt || '待定'}</dd></div>
              </dl>
              {item.fileName && <small>附件 · {item.fileName}</small>}
              <div className="daily-card-actions">
                {item.url && <a className="text-action" href={item.url} target="_blank" rel="noreferrer">查看通知</a>}
                {item.fileId && <button type="button" className="text-action" onClick={() => void openStoredFile(item.fileId!)}>预览附件</button>}
                {item.fileId && (
                  <button type="button" className="text-action" onClick={() => setHandlingNoticeId((value) => value === item.id ? '' : item.id)}>
                    {handlingNoticeId === item.id ? '收起' : '查看正文'}
                  </button>
                )}
                {tab === 'upcoming' ? (
                  <button type="button" className="primary-action" onClick={() => {
                    patchNotice(item.id, { status: 'open' })
                    notify.success(`「${item.title}」已移至已开始`)
                  }}>标记已开始</button>
                ) : (
                  <button type="button" className="primary-action" onClick={() => startFromNotice(item)}>开始申报</button>
                )}
                <button type="button" className="text-action" onClick={() => onChangeNotices(notices.filter((row) => row.id !== item.id))}>删除</button>
              </div>
              {handlingNoticeId === item.id && item.fileId && (
                <StoredFileEditor
                  fileId={item.fileId}
                  fileName={item.fileName}
                  mimeType={item.mimeType}
                  title={item.title}
                  note={item.note}
                  extractedText={item.extractedText}
                  onMeta={(patch) => patchNotice(item.id, patch)}
                />
              )}
            </article>
          ))}
          {visibleNotices.length === 0 && <div className="course-empty research-empty">这里还没有通知，点击右上角上传第一份。</div>}
        </div>
      ) : (
        <div className="daily-split research-workspace">
          <div className="research-project-rail">
            <p className="section-label">{tab === 'ended' ? '归档项目' : '我的项目'}</p>
            <div className="daily-list">
              {visibleProjects.map((item) => (
                <button type="button" className={item.id === selectedId ? 'daily-list-item is-active' : 'daily-list-item'} key={item.id} onClick={() => setSelectedId(item.id)}>
                  <span className="research-list-line"><strong>{item.title}</strong><i>{stageLabel(item)}</i></span>
                  <small>{item.category} · {item.materials.length} 份材料</small>
                </button>
              ))}
              {visibleProjects.length === 0 && <div className="course-empty">{tab === 'ended' ? '还没有已归档项目' : '还没有正在进行的项目'}</div>}
            </div>
          </div>

          {selected && visibleProjects.some((item) => item.id === selected.id) ? (
            <article className="settings-card daily-detail research-detail">
              <header className="research-detail-head">
                <div><p className="section-label">{selected.category}</p><h2>{selected.title}</h2>{selected.summary && <p>{selected.summary}</p>}</div>
                <span className={`research-project-state is-${selected.status}`}>{stageLabel(selected)}</span>
              </header>

              {selected.status !== 'ended' ? (
                <label className="research-stage-select">
                  当前阶段
                  <select value={selected.status} onChange={(event) => patchProject(selected.id, { status: event.target.value as 'applying' | 'closing' })}>
                    <option value="applying">申报中</option>
                    <option value="closing">执行中</option>
                  </select>
                </label>
              ) : (
                <p className="research-archive-date">归档时间：{selected.endDate || '未记录'}</p>
              )}

              <section className="research-material-section">
                <div className="research-section-heading">
                  <div><p className="section-label">资料与文稿</p><h3>{selected.status === 'ended' ? '归档内容' : '上传文件，或直接新建在线文稿'}</h3></div>
                  {selected.status !== 'ended' && <span>项目资料 · 正在撰写 · 最终版</span>}
                </div>
                <WorkMaterialsPanel
                  materials={selected.materials}
                  kinds={MATERIAL_KINDS}
                  smartOptimize
                  readOnly={selected.status === 'ended'}
                  onOpenSettings={onOpenSettings}
                  onChange={(materials) => patchProject(selected.id, { materials })}
                />
              </section>

              <footer className="research-detail-actions">
                {selected.status === 'ended' ? (
                  <button type="button" className="outline-action" onClick={() => {
                    patchProject(selected.id, { status: 'closing', endDate: undefined })
                    setTab('active')
                    notify.info(`「${selected.title}」已重新打开`)
                  }}>重新打开项目</button>
                ) : (
                  <><p>添加“最终版”材料后即可完成归档。</p><button type="button" className="primary-action" onClick={() => archiveProject(selected)}>上传完成，结束并归档</button></>
                )}
              </footer>
            </article>
          ) : (
            <div className="course-empty daily-detail-empty">选择左侧项目查看资料</div>
          )}
        </div>
      )}
    </section>
  )
}
