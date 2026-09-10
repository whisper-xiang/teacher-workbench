import { useMemo, useState } from 'react'
import '../components/course-tabs.css'
import '../daily-work.css'
import { FileIntake } from '../components/FileIntake'
import { WorkMaterialsPanel } from '../components/WorkMaterialsPanel'
import { uid } from '../data/store'
import { ACTIVITY_CATEGORIES, type ActivityCategory, type ActivityProject, type ActivityProjectStatus, type WorkMaterial } from '../data/types'
import { fillIfEmpty, guessFromFile } from '../lib/intake-file'
import { notify } from '../lib/notify'
import { activityProgress } from '../lib/project-progress'
import { formatFileSize, putResourceFile } from '../lib/resource-files'

type Props = {
  projects: ActivityProject[]
  onChangeProjects: (projects: ActivityProject[]) => void
}

const STATUS_LABEL: Record<ActivityProjectStatus, string> = {
  planning: '筹备',
  doing: '进行中',
  closing: '收尾',
  done: '已完成',
}

const ACTIVITY_PRESETS: Record<ActivityCategory, string[]> = {
  大创: ['国家级大学生创新创业训练计划', '省级大创', '校级大创'],
  三下乡: ['暑期三下乡社会实践', '寒假返乡实践'],
  挑战杯: ['挑战杯课外学术作品竞赛', '挑战杯创业计划竞赛'],
  '互联网+': ['中国国际大学生创新大赛（互联网+）'],
  其他: ['师范生技能大赛', '学生社团指导'],
}

export function ActivitiesPage({ projects, onChangeProjects }: Props) {
  const [category, setCategory] = useState<ActivityCategory>('大创')
  const [selectedId, setSelectedId] = useState('')
  const [preset, setPreset] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [intakeFile, setIntakeFile] = useState<File | null>(null)
  const [intakeBusy, setIntakeBusy] = useState(false)

  const visible = useMemo(() => projects.filter((item) => item.category === category), [projects, category])
  const selected = projects.find((item) => item.id === selectedId && item.category === category)
  const presets = ACTIVITY_PRESETS[category]

  const addProject = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      notify.warning('请填写项目名称，或先上传文件自动识别')
      return
    }
    const materials: WorkMaterial[] = []
    if (intakeFile) {
      const fileId = uid('file')
      try {
        await putResourceFile(fileId, intakeFile, intakeFile.name)
      } catch (error) {
        notify.error(error instanceof Error ? error.message : '文件保存失败')
        return
      }
      const guess = await guessFromFile(intakeFile, ['立项', '过程', '总结', '其他'])
      materials.push({
        id: uid('mat'),
        title: guess.title || intakeFile.name,
        kind: guess.kind || '立项',
        fileId,
        fileName: intakeFile.name,
        mimeType: intakeFile.type,
        size: formatFileSize(intakeFile.size),
        updated: '刚刚',
        extractedText: guess.extractedText,
      })
    }
    const next: ActivityProject = {
      id: uid('ap'),
      title: title.trim(),
      category,
      summary: summary.trim(),
      status: 'planning',
      milestones: [
        { id: uid('ms'), name: '立项 / 组队', done: false },
        { id: uid('ms'), name: '过程实施', done: false },
        { id: uid('ms'), name: '材料归档', done: false },
      ],
      materials,
    }
    onChangeProjects([next, ...projects])
    setPreset('')
    setTitle('')
    setSummary('')
    setIntakeFile(null)
    setSelectedId(next.id)
    notify.success(intakeFile ? `已在「${category}」添加「${next.title}」，可在下方处理文件` : `已在「${category}」添加「${next.title}」`)
  }

  const takeIntakeFile = async (file: File | null) => {
    setIntakeFile(file)
    if (!file) return
    setIntakeBusy(true)
    try {
      const guess = await guessFromFile(file, ['立项', '过程', '总结', '其他'])
      setTitle((current) => fillIfEmpty(current, guess.title))
      setSummary((current) => fillIfEmpty(current, guess.summary))
      const matched = ACTIVITY_CATEGORIES.find((item) => item === guess.category)
      if (matched) setCategory(matched)
      notify.info('已按文件识别，名称仍可手改')
    } finally {
      setIntakeBusy(false)
    }
  }

  const patchProject = (id: string, patch: Partial<ActivityProject>) => {
    onChangeProjects(projects.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  return (
    <section className="activities-page daily-work-page" aria-label="学生活动">
      <div className="courses-heading">
        <div>
          <p className="section-label">日常工作 · 学生活动</p>
          <h1>学生活动</h1>
          <p>从常见项目中选择，也可以自己录入或上传文件自动识别；资料保存在本机，打开项目后可预览和整理</p>
        </div>
      </div>

      <div className="students-course-tabs" role="tablist" aria-label="活动类型">
        {ACTIVITY_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            className={category === item ? 'active' : ''}
            onClick={() => {
              setCategory(item)
              setSelectedId('')
              setPreset('')
              setTitle('')
            }}
          >
            {item}
            <small>{projects.filter((row) => row.category === item).length}</small>
          </button>
        ))}
      </div>

      <form className="daily-create-card" onSubmit={(event) => void addProject(event)}>
        <div>
          <p className="section-label">新建{category}项目</p>
          <h2>上传材料自动识别，或选择 / 手填名称</h2>
        </div>
        <FileIntake
          file={intakeFile}
          busy={intakeBusy}
          label="上传通知或材料，自动识别名称"
          onFile={(file) => void takeIntakeFile(file)}
        />
        <div className="daily-create-grid">
          <label>
            常见项目
            <select
              value={preset}
              onChange={(event) => {
                const value = event.target.value
                setPreset(value)
                if (value) setTitle(value)
              }}
            >
              <option value="">自行填写</option>
              {presets.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            项目名称
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${category}项目名称`} />
          </label>
          <label className="daily-create-span">
            一句话说明
            <input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="可选，如指导对象、本学期节点" />
          </label>
        </div>
        <button className="primary-action" type="submit" disabled={intakeBusy}>
          ＋ 添加项目
        </button>
      </form>

      <div className="daily-card-grid activity-card-grid">
        {visible.map((item) => {
          const progress = activityProgress(item)
          return (
            <button
              type="button"
              className={item.id === selectedId ? 'daily-card activity-card is-active' : 'daily-card activity-card'}
              key={item.id}
              onClick={() => setSelectedId(item.id === selectedId ? '' : item.id)}
            >
              <span className="resource-type-pill">{STATUS_LABEL[item.status]}</span>
              <h3>{item.title}</h3>
              {item.summary ? <p>{item.summary}</p> : <p>点击查看节点与资料</p>}
              <div className="course-overview-progress">
                <div>
                  <span>进度</span>
                  <strong>{progress}%</strong>
                </div>
                <div className="progress-track">
                  <i style={{ width: `${progress}%` }} />
                </div>
              </div>
            </button>
          )
        })}
        {visible.length === 0 && <div className="course-empty">该分类下还没有项目，可在上方选择或录入</div>}
      </div>

      {selected ? (
        <article className="settings-card daily-detail activity-detail">
          <p className="section-label">{selected.category}</p>
          <h2>{selected.title}</h2>
          {selected.summary && <p>{selected.summary}</p>}
          <label>
            状态
            <select
              value={selected.status}
              onChange={(event) => patchProject(selected.id, { status: event.target.value as ActivityProjectStatus })}
            >
              {(Object.keys(STATUS_LABEL) as ActivityProjectStatus[]).map((item) => (
                <option key={item} value={item}>
                  {STATUS_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <div className="course-overview-progress">
            <div>
              <span>进度</span>
              <strong>{activityProgress(selected)}%</strong>
            </div>
            <div className="progress-track">
              <i style={{ width: `${activityProgress(selected)}%` }} />
            </div>
          </div>

          <p className="section-label">节点</p>
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
                </label>
              </li>
            ))}
          </ul>

          <p className="section-label">资料整理</p>
          <WorkMaterialsPanel
            materials={selected.materials}
            kinds={['立项', '过程', '总结', '其他']}
            onChange={(materials) => patchProject(selected.id, { materials })}
          />
        </article>
      ) : null}
    </section>
  )
}
