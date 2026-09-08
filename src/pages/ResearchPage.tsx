import { useMemo, useState } from 'react'
import { FileIntake } from '../components/FileIntake'
import { StoredFileEditor } from '../components/StoredFileEditor'
import { WorkMaterialsPanel } from '../components/WorkMaterialsPanel'
import { uid } from '../data/store'
import type { ResearchNotice, ResearchProject, ResearchProjectStatus, WorkMaterial } from '../data/types'
import { fillIfEmpty, guessFromFile } from '../lib/intake-file'
import { notify } from '../lib/notify'
import { researchClosingProgress } from '../lib/project-progress'
import { formatFileSize, openStoredFile, putResourceFile } from '../lib/resource-files'

type TabId = 'upcoming' | 'open' | 'applying' | 'closing' | 'ended'

const TABS: { id: TabId; label: string }[] = [
  { id: 'upcoming', label: '即将开始' },
  { id: 'open', label: '已经开始' },
  { id: 'applying', label: '进行中' },
  { id: 'closing', label: '我的' },
  { id: 'ended', label: '已结束' },
]

type Props = {
  notices: ResearchNotice[]
  projects: ResearchProject[]
  onChangeNotices: (notices: ResearchNotice[]) => void
  onChangeProjects: (projects: ResearchProject[]) => void
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
  { id: uid('ms'), name: '立项', done: false },
  { id: uid('ms'), name: '中期检查', done: false },
  { id: uid('ms'), name: '结题验收', done: false },
]

export function ResearchPage({ notices, projects, onChangeNotices, onChangeProjects }: Props) {
  const [tab, setTab] = useState<TabId>('upcoming')
  const [selectedId, setSelectedId] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('校级')
  const [summary, setSummary] = useState('')
  const [achievementTitle, setAchievementTitle] = useState('')
  const [noticePreset, setNoticePreset] = useState('')
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeSource, setNoticeSource] = useState('')
  const [noticeCategory, setNoticeCategory] = useState('其他')
  const [noticeOpenAt, setNoticeOpenAt] = useState('')
  const [noticeCloseAt, setNoticeCloseAt] = useState('')
  const [noticeFile, setNoticeFile] = useState<File | null>(null)
  const [noticeBusy, setNoticeBusy] = useState(false)
  const [handlingNoticeId, setHandlingNoticeId] = useState('')
  const [projectFile, setProjectFile] = useState<File | null>(null)
  const [projectBusy, setProjectBusy] = useState(false)

  const selected = projects.find((item) => item.id === selectedId)

  const visibleNotices = useMemo(
    () => notices.filter((item) => (tab === 'upcoming' ? item.status === 'upcoming' : item.status === 'open')),
    [notices, tab],
  )

  const visibleProjects = useMemo(() => {
    const status: ResearchProjectStatus | null =
      tab === 'applying' ? 'applying' : tab === 'closing' ? 'closing' : tab === 'ended' ? 'ended' : null
    if (!status) return []
    return projects.filter((item) => item.status === status)
  }, [projects, tab])

  const startFromNotice = (notice: ResearchNotice) => {
    const material: WorkMaterial | undefined = notice.fileId
      ? {
          id: uid('mat'),
          title: notice.title,
          kind: '立项',
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
      startDate: notice.openAt,
      endDate: notice.closeAt,
      milestones: defaultMilestones(),
      materials: material ? [material] : [],
      achievements: [],
    }
    onChangeProjects([next, ...projects])
    setTab('applying')
    setSelectedId(next.id)
    notify.success(`已开始申请「${notice.title}」`)
  }

  const addProject = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      notify.warning('请填写项目名称，或先上传文件自动识别')
      return
    }
    const materials: WorkMaterial[] = []
    if (projectFile) {
      const fileId = uid('file')
      try {
        await putResourceFile(fileId, projectFile, projectFile.name)
      } catch (error) {
        notify.error(error instanceof Error ? error.message : '文件保存失败')
        return
      }
      const guess = await guessFromFile(projectFile, ['立项', '中期', '结题', '其他'])
      materials.push({
        id: uid('mat'),
        title: guess.title || projectFile.name,
        kind: guess.kind || '立项',
        fileId,
        fileName: projectFile.name,
        mimeType: projectFile.type,
        size: formatFileSize(projectFile.size),
        updated: '刚刚',
        extractedText: guess.extractedText,
      })
    }
    const status: ResearchProjectStatus = tab === 'ended' ? 'ended' : tab === 'closing' ? 'closing' : 'applying'
    const next: ResearchProject = {
      id: uid('rp'),
      title: title.trim(),
      category: category.trim() || '其他',
      status,
      summary: summary.trim(),
      milestones: defaultMilestones(),
      materials,
      achievements: tab === 'closing' ? [] : [],
    }
    onChangeProjects([next, ...projects])
    setTitle('')
    setSummary('')
    setProjectFile(null)
    setSelectedId(next.id)
    notify.success(projectFile ? `已添加「${next.title}」，可在右侧处理文件` : `已添加「${next.title}」`)
  }

  const addNotice = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!noticeTitle.trim()) {
      notify.warning('请填写名称，或先上传文件自动识别')
      return
    }
    let fileMeta: Pick<ResearchNotice, 'fileId' | 'fileName' | 'mimeType' | 'size' | 'extractedText'> = {}
    if (noticeFile) {
      const fileId = uid('file')
      try {
        await putResourceFile(fileId, noticeFile, noticeFile.name)
      } catch (error) {
        notify.error(error instanceof Error ? error.message : '文件保存失败')
        return
      }
      const guess = await guessFromFile(noticeFile)
      fileMeta = {
        fileId,
        fileName: noticeFile.name,
        mimeType: noticeFile.type,
        size: formatFileSize(noticeFile.size),
        extractedText: guess.extractedText,
      }
    }
    const next: ResearchNotice = {
      id: uid('rn'),
      title: noticeTitle.trim(),
      source: noticeSource.trim() || '手工录入',
      summary: '',
      category: noticeCategory.trim() || '其他',
      openAt: noticeOpenAt || '',
      closeAt: noticeCloseAt || '',
      status: tab === 'open' ? 'open' : 'upcoming',
      ...fileMeta,
    }
    onChangeNotices([next, ...notices])
    setNoticePreset('')
    setNoticeTitle('')
    setNoticeSource('')
    setNoticeCategory('其他')
    setNoticeOpenAt('')
    setNoticeCloseAt('')
    setNoticeFile(null)
    setHandlingNoticeId(next.id)
    notify.success(noticeFile ? `已录入「${next.title}」，可在卡片里处理文件` : `已录入「${next.title}」`)
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
      notify.info('已按文件识别，名称和日期仍可手改')
    } finally {
      setNoticeBusy(false)
    }
  }

  const patchNotice = (id: string, patch: Partial<ResearchNotice>) => {
    onChangeNotices(notices.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const applyNoticePreset = (value: string) => {
    setNoticePreset(value)
    const preset = RESEARCH_PRESETS.find((item) => item.title === value)
    if (preset) {
      setNoticeTitle(preset.title)
      setNoticeSource(preset.source)
      setNoticeCategory(preset.category)
    }
  }

  const patchProject = (id: string, patch: Partial<ResearchProject>) => {
    onChangeProjects(projects.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const showNotices = tab === 'upcoming' || tab === 'open'

  return (
    <section className="research-page daily-work-page" aria-label="科研">
      <div className="courses-heading">
        <div>
          <p className="section-label">日常工作 · 科研</p>
          <h1>科研</h1>
          <p>上传申报通知可自动识别名称和日期，也可手填；文件保存在本机，录入后可在卡片里预览和整理</p>
        </div>
      </div>

      <div className="students-course-tabs" role="tablist" aria-label="科研分类">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            onClick={() => {
              setTab(item.id)
              setSelectedId('')
            }}
          >
            {item.label}
            <small>
              {item.id === 'upcoming' || item.id === 'open'
                ? notices.filter((row) => row.status === (item.id === 'upcoming' ? 'upcoming' : 'open')).length
                : projects.filter((row) => row.status === item.id).length}
            </small>
          </button>
        ))}
      </div>

      {showNotices ? (
        <>
          <form className="daily-create-card" onSubmit={(event) => void addNotice(event)}>
            <div>
              <p className="section-label">手工录入申报</p>
              <h2>上传通知自动识别，或自己填写</h2>
            </div>
            <FileIntake
              file={noticeFile}
              onFile={(file) => void applyNoticeFile(file)}
              busy={noticeBusy}
              label="上传通知 PDF / Word / 文本，自动识别名称和日期"
            />
            <div className="daily-create-grid">
              <label>
                常见申报
                <select value={noticePreset} onChange={(event) => applyNoticePreset(event.target.value)}>
                  <option value="">自行填写</option>
                  {RESEARCH_PRESETS.map((item) => (
                    <option key={item.title} value={item.title}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                名称
                <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="申报项目名称" />
              </label>
              <label>
                来源
                <input value={noticeSource} onChange={(event) => setNoticeSource(event.target.value)} placeholder="如 教育部社科司" />
              </label>
              <label>
                类别
                <input value={noticeCategory} onChange={(event) => setNoticeCategory(event.target.value)} placeholder="如 省规划" />
              </label>
              <label>
                {tab === 'upcoming' ? '预计开放' : '开始日期'}
                <input type="date" value={noticeOpenAt} onChange={(event) => setNoticeOpenAt(event.target.value)} />
              </label>
              <label>
                截止日期
                <input type="date" value={noticeCloseAt} onChange={(event) => setNoticeCloseAt(event.target.value)} />
              </label>
            </div>
            <button className="primary-action" type="submit" disabled={noticeBusy}>
              录入到{tab === 'open' ? '已经开始' : '即将开始'}
            </button>
          </form>
          <div className="daily-card-grid">
            {visibleNotices.map((item) => (
              <article className="daily-card" key={item.id}>
                <span className="resource-type-pill">{item.category}</span>
                <h3>{item.title}</h3>
                {item.summary ? <p>{item.summary}</p> : null}
                <small>
                  {item.source}
                  {item.fileName ? ` · ${item.fileName}` : ''}
                  {item.openAt || item.closeAt
                    ? ` · ${tab === 'upcoming' ? `预计 ${item.openAt || '待定'} 开放` : `受理至 ${item.closeAt || '待定'}`}`
                    : ''}
                </small>
                <div className="daily-card-actions">
                  {item.url && (
                    <a className="text-action" href={item.url} target="_blank" rel="noreferrer">
                      查看通知
                    </a>
                  )}
                  {item.fileId && (
                    <button type="button" className="text-action" onClick={() => void openStoredFile(item.fileId!)}>
                      预览
                    </button>
                  )}
                  {item.fileId && (
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => setHandlingNoticeId((current) => (current === item.id ? '' : item.id))}
                    >
                      {handlingNoticeId === item.id ? '收起' : '处理文件'}
                    </button>
                  )}
                  {tab === 'open' && (
                    <button type="button" className="primary-action" onClick={() => startFromNotice(item)}>
                      开始申请
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => onChangeNotices(notices.filter((row) => row.id !== item.id))}
                  >
                    移除
                  </button>
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
            {visibleNotices.length === 0 && <div className="course-empty">这一栏暂时没有通知，可在上方选择或录入</div>}
          </div>
        </>
      ) : (
        <div className="daily-split">
          <div>
            <form className="work-materials-form daily-create-form" onSubmit={(event) => void addProject(event)}>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="项目名称，如 2026大创" />
              <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="类别" />
              <input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="一句话说明（可选）" />
              <button className="primary-action" type="submit" disabled={projectBusy}>
                ＋ 新建
              </button>
            </form>
            <FileIntake
              file={projectFile}
              busy={projectBusy}
              label="也可上传材料自动识别名称"
              onFile={(file) => {
                setProjectFile(file)
                if (!file) return
                setProjectBusy(true)
                void guessFromFile(file, ['立项', '中期', '结题', '其他'])
                  .then((guess) => {
                    setTitle((current) => fillIfEmpty(current, guess.title))
                    setCategory((current) => fillIfEmpty(current, guess.category))
                    setSummary((current) => fillIfEmpty(current, guess.summary))
                    notify.info('已按文件识别，名称仍可手改')
                  })
                  .finally(() => setProjectBusy(false))
              }}
            />
            <div className="daily-list">
              {visibleProjects.map((item) => {
                const progress = item.status === 'closing' ? researchClosingProgress(item) : undefined
                return (
                  <button
                    type="button"
                    className={item.id === selectedId ? 'daily-list-item is-active' : 'daily-list-item'}
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <small>
                      {item.category}
                      {progress !== undefined ? ` · 结题进度 ${progress}%` : ''}
                    </small>
                    {progress !== undefined && (
                      <div className="progress-track">
                        <i style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </button>
                )
              })}
              {visibleProjects.length === 0 && <div className="course-empty">还没有项目，可在上方新建</div>}
            </div>
          </div>

          {selected ? (
            <article className="settings-card daily-detail">
              <p className="section-label">{selected.category}</p>
              <h2>{selected.title}</h2>
              {selected.summary && <p>{selected.summary}</p>}
              {selected.status === 'closing' && (
                <div className="course-overview-progress">
                  <div>
                    <span>结题进度（按成果完成情况）</span>
                    <strong>{researchClosingProgress(selected)}%</strong>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${researchClosingProgress(selected)}%` }} />
                  </div>
                </div>
              )}

              <p className="section-label">阶段</p>
              <ul className="daily-check-list">
                {selected.milestones.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={(event) =>
                          patchProject(selected.id, {
                            milestones: selected.milestones.map((row) =>
                              row.id === item.id ? { ...row, done: event.target.checked } : row,
                            ),
                          })
                        }
                      />
                      {item.name}
                      {item.due ? `（至 ${item.due}）` : ''}
                    </label>
                  </li>
                ))}
              </ul>

              {selected.status !== 'applying' && (
                <>
                  <p className="section-label">成果情况</p>
                  <ul className="daily-check-list">
                    {selected.achievements.map((item) => (
                      <li key={item.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(event) =>
                              patchProject(selected.id, {
                                achievements: selected.achievements.map((row) =>
                                  row.id === item.id ? { ...row, done: event.target.checked } : row,
                                ),
                              })
                            }
                          />
                          {item.title}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <form
                    className="work-materials-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (!achievementTitle.trim()) return
                      patchProject(selected.id, {
                        achievements: [
                          ...selected.achievements,
                          { id: uid('ach'), title: achievementTitle.trim(), done: false },
                        ],
                      })
                      setAchievementTitle('')
                    }}
                  >
                    <input
                      value={achievementTitle}
                      onChange={(event) => setAchievementTitle(event.target.value)}
                      placeholder="新增成果，如 学生实践报告"
                    />
                    <button className="outline-action" type="submit">
                      添加成果
                    </button>
                  </form>
                </>
              )}

              <p className="section-label">立项 / 中期 / 结题资料</p>
              <WorkMaterialsPanel
                materials={selected.materials}
                kinds={['立项', '中期', '结题', '其他']}
                onChange={(materials) => patchProject(selected.id, { materials })}
              />

              <div className="daily-card-actions">
                {selected.status === 'applying' && (
                  <button type="button" className="outline-action" onClick={() => patchProject(selected.id, { status: 'closing' })}>
                    转入我的（整理结题）
                  </button>
                )}
                {selected.status === 'closing' && (
                  <button type="button" className="primary-action" onClick={() => patchProject(selected.id, { status: 'ended' })}>
                    标记已结题
                  </button>
                )}
              </div>
            </article>
          ) : (
            <div className="course-empty daily-detail-empty">选择左侧项目查看资料与进度</div>
          )}
        </div>
      )}
    </section>
  )
}
