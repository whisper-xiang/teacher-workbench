import { useEffect, useRef, useState } from 'react'
import '../settings.css'
import type { TeacherProfile, WorkbenchMeta } from '../data/types'
import { thisMondayIso, termWeekOf } from '../lib/dates'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'
import { deleteResourceFile, getResourceFile, putResourceFile } from '../lib/resource-files'
import { DEFAULT_Q_PET_SRC, generateQPetSprite, PET_AVATAR_FILE_ID, saveGeneratedPet } from '../lib/q-pet'
import { PET_PRESETS, resolvePetKind } from '../lib/pet-kind'
import { PetMascot } from '../components/PetMascots'
import {
  ATMOSPHERE_FILE_ID,
  ATMOSPHERE_PRESETS,
  resolveAtmosphereId,
} from '../lib/atmosphere'
import { hasLlmSettings, loadLlmSettings, saveLlmSettings, type LlmSettings } from '../lib/llm-settings'
import { parseSettingsSection, type SettingsSectionId } from '../lib/settings-nav'
import { describeStorageLocation } from '../lib/storage-location'

type Props = {
  section?: SettingsSectionId
  profile: TeacherProfile
  meta: WorkbenchMeta
  updatedAt: string
  onSaveProfile: (profile: TeacherProfile, meta: WorkbenchMeta) => void
  onExport: () => string
  onImport: (json: string) => void
  onReset: () => void
}

function clampWeek(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(22, Math.max(1, Math.round(value)))
}

function withGreeting(profile: TeacherProfile): TeacherProfile {
  const name = profile.name.trim()
  return { ...profile, name, greetingName: name ? `${name}老师` : profile.greetingName }
}

function liveMeta(meta: WorkbenchMeta): WorkbenchMeta {
  return {
    ...meta,
    weekNumber: termWeekOf(new Date(), meta.weekStart, meta.weekNumber),
    weekStart: thisMondayIso(),
  }
}

function sameProfile(a: TeacherProfile, b: TeacherProfile) {
  return (
    a.name === b.name &&
    a.title === b.title &&
    a.college === b.college &&
    a.greetingName === b.greetingName &&
    a.petKind === b.petKind &&
    a.petAvatarId === b.petAvatarId &&
    a.atmosphereId === b.atmosphereId &&
    a.atmosphereFileId === b.atmosphereFileId
  )
}

function sameMeta(a: WorkbenchMeta, b: WorkbenchMeta) {
  return a.termLabel === b.termLabel && a.weekNumber === b.weekNumber && a.weekStart === b.weekStart
}

function pathForDisplay(path: string | null) {
  return path ? path.replace(/([/\\])/g, '$1\u200b').replace(/(\.indexeddb)/g, '\u200b$1') : ''
}

export function SettingsPage({ section: sectionProp, profile, meta, updatedAt, onSaveProfile, onExport, onImport, onReset }: Props) {
  const section = parseSettingsSection(sectionProp)
  const [form, setForm] = useState(() => withGreeting(profile))
  const [metaForm, setMetaForm] = useState(() => liveMeta(meta))
  const fileRef = useRef<HTMLInputElement>(null)
  const petInputRef = useRef<HTMLInputElement>(null)
  const atmosphereInputRef = useRef<HTMLInputElement>(null)
  const [qPreview, setQPreview] = useState<string | null>(DEFAULT_Q_PET_SRC)
  const [atmospherePreview, setAtmospherePreview] = useState<string | null>(null)
  const [petBusy, setPetBusy] = useState(false)
  const [llm, setLlm] = useState(loadLlmSettings)

  useEffect(() => {
    setForm(withGreeting(profile))
    setMetaForm(liveMeta(meta))
  }, [updatedAt]) // 导入/重置后整页对齐；输入过程不回写，避免冲掉未失焦的修改

  useEffect(() => {
    let url: string | null = null
    if (!profile.petAvatarId) {
      setQPreview(DEFAULT_Q_PET_SRC)
      return undefined
    }
    void getResourceFile(profile.petAvatarId).then((stored) => {
      if (!stored) return
      url = URL.createObjectURL(stored.blob)
      setQPreview(url)
    })
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [profile.petAvatarId])

  useEffect(() => {
    let url: string | null = null
    if (!profile.atmosphereFileId) {
      setAtmospherePreview(null)
      return undefined
    }
    void getResourceFile(profile.atmosphereFileId).then((stored) => {
      if (!stored) return
      url = URL.createObjectURL(stored.blob)
      setAtmospherePreview(url)
    })
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [profile.atmosphereFileId])

  const persist = (nextProfile: TeacherProfile, nextMeta: WorkbenchMeta, toast?: string) => {
    const profileToSave = withGreeting(nextProfile)
    const metaToSave: WorkbenchMeta = {
      ...nextMeta,
      termLabel: nextMeta.termLabel.trim(),
      weekNumber: clampWeek(nextMeta.weekNumber),
      weekStart: thisMondayIso(),
    }
    setForm(profileToSave)
    setMetaForm(metaToSave)
    if (sameProfile(profileToSave, withGreeting(profile)) && sameMeta(metaToSave, liveMeta(meta))) return
    onSaveProfile(profileToSave, metaToSave)
    if (toast) notify.success(toast)
  }

  const downloadBackup = () => {
    const json = onExport()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `教学工作台备份-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify.success('备份文件已下载')
  }

  const applyPet = (next: TeacherProfile, toast: string) => {
    persist(next, metaForm, toast)
  }

  const applyAtmosphere = (next: TeacherProfile, toast: string) => {
    persist(next, metaForm, toast)
  }

  const saveAtmospherePhoto = async (file: File) => {
    try {
      await putResourceFile(ATMOSPHERE_FILE_ID, file, file.name)
      const url = URL.createObjectURL(file)
      setAtmospherePreview((current) => {
        if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
        return url
      })
      applyAtmosphere(
        { ...form, atmosphereId: 'photo', atmosphereFileId: ATMOSPHERE_FILE_ID },
        '背景已换成你的照片',
      )
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '照片保存失败')
    }
  }

  const generateFromPhoto = async (file: File) => {
    setPetBusy(true)
    try {
      const blob = await generateQPetSprite(file)
      await saveGeneratedPet(blob)
      const url = URL.createObjectURL(blob)
      setQPreview((current) => {
        if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
        return url
      })
      applyPet({ ...form, petAvatarId: PET_AVATAR_FILE_ID, petKind: 'photo' }, 'Q 版大头已生成，桌宠已换上')
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '生成失败')
    } finally {
      setPetBusy(false)
    }
  }

  const copyTextValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      notify.success(`已复制${label}`)
    } catch {
      notify.warning('复制失败，请手动选择文字')
    }
  }

  const persistLlm = (next: LlmSettings, toast?: string) => {
    const saved = {
      baseUrl: next.baseUrl.trim(),
      apiKey: next.apiKey.trim(),
      model: next.model.trim(),
    }
    setLlm(saved)
    saveLlmSettings(saved)
    window.dispatchEvent(new Event('teacher-llm-changed'))
    if (toast) notify.success(toast)
  }

  const selectedKind = resolvePetKind(form)
  const selectedAtmosphere = resolveAtmosphereId(form)
  const storageLocation = describeStorageLocation()

  const heading =
    section === 'profile'
      ? { title: '个人信息', lead: '改完即存。概览会按这里的称呼问候你。' }
      : section === 'appearance'
        ? { title: '外观', lead: '点一下就换整页风景。自己的照片只留在这台电脑。' }
        : section === 'data'
          ? { title: '数据', lead: '全部留在这台电脑。换电脑前先导出一份。' }
          : section === 'model'
            ? { title: '模型配置', lead: '论文分析和科研材料优化走这里的接口。密钥不进 JSON 备份。' }
            : { title: '桌面宠物', lead: '点一下就换。默认 Q 版守在右下角；也可以再传照片，在本机生成。' }

  return (
    <section className="settings-page" aria-label={heading.title}>
      <div className="settings-heading">
        <h1>{heading.title}</h1>
        <p>{heading.lead}</p>
      </div>

      <div className="settings-stack">
        {section === 'profile' && (
          <>
        <section className="settings-block" aria-labelledby="settings-me">
          <h2 id="settings-me">我</h2>
          <div className="settings-grid">
            <label>
              姓名
              <input
                value={form.name}
                onChange={(event) => setForm(withGreeting({ ...form, name: event.target.value }))}
                onBlur={(event) => persist(withGreeting({ ...form, name: event.target.value }), metaForm)}
                required
              />
            </label>
            <label>
              职称
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                onBlur={(event) => persist({ ...form, title: event.target.value }, metaForm)}
              />
            </label>
            <label className="settings-span">
              学院
              <input
                value={form.college}
                onChange={(event) => setForm({ ...form, college: event.target.value })}
                onBlur={(event) => persist({ ...form, college: event.target.value }, metaForm)}
              />
            </label>
          </div>
          <p className="settings-help">概览会叫你「{form.greetingName || '老师'}」。侧栏显示学院与职称。</p>
        </section>

        <section className="settings-block" aria-labelledby="settings-term">
          <h2 id="settings-term">学期</h2>
          <div className="settings-grid">
            <label className="settings-span">
              学期名称
              <input
                value={metaForm.termLabel}
                onChange={(event) => setMetaForm({ ...metaForm, termLabel: event.target.value })}
                onBlur={(event) => persist(form, { ...metaForm, termLabel: event.target.value })}
              />
            </label>
            <label className="settings-span">
              当前教学周
              <input
                type="number"
                min={1}
                max={22}
                value={metaForm.weekNumber}
                onChange={(event) => setMetaForm({ ...metaForm, weekNumber: Number(event.target.value) })}
                onBlur={(event) => persist(form, { ...metaForm, weekNumber: Number(event.target.value) })}
              />
            </label>
          </div>
          <p className="settings-help">今天是第 {metaForm.weekNumber} 周。之后按真实日期自动往后计，不用每周来改。</p>
        </section>
          </>
        )}

        {section === 'model' && (
        <section className="settings-block" aria-labelledby="settings-llm">
          <h2 id="settings-llm">智能文本处理</h2>
          <p className="settings-help">
            侧栏助手使用豆包 Mini，与这里的论文分析接口分开。确认后才写入本机提醒、课程、资源和任务。
          </p>
          <div className="settings-grid">
            <label className="settings-span">
              接口地址
              <input
                value={llm.baseUrl}
                onChange={(event) => setLlm({ ...llm, baseUrl: event.target.value })}
                onBlur={(event) => persistLlm({ ...llm, baseUrl: event.target.value })}
                placeholder="https://api.deepseek.com/v1"
                autoComplete="off"
              />
            </label>
            <label>
              模型
              <input
                value={llm.model}
                onChange={(event) => setLlm({ ...llm, model: event.target.value })}
                onBlur={(event) => persistLlm({ ...llm, model: event.target.value })}
                placeholder="deepseek-chat"
                autoComplete="off"
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={llm.apiKey}
                onChange={(event) => setLlm({ ...llm, apiKey: event.target.value })}
                onBlur={(event) => persistLlm({ ...llm, apiKey: event.target.value })}
                placeholder="只留在这台电脑"
                autoComplete="off"
              />
            </label>
          </div>
          <p className="settings-help">
            {hasLlmSettings(llm)
              ? '论文分析或科研材料优化时，当前正文会发往这个接口。密钥不进 JSON 备份。'
              : '填齐三项后，论文分析和科研材料优化才能调用模型。密钥不进 JSON 备份。'}
          </p>
        </section>
        )}

        {section === 'pet' && (
        <section className="settings-block" aria-labelledby="settings-pet">
          <h2 id="settings-pet">桌宠</h2>
          <div className="pet-preset-grid">
            {PET_PRESETS.map((preset) => {
              const selected = selectedKind === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`pet-preset-card${selected ? ' is-on' : ''}`}
                  aria-pressed={selected}
                  onClick={() => applyPet({ ...form, petKind: preset.id }, `桌宠已换成${preset.label}`)}
                >
                  {preset.id === 'live2d-cat' || preset.id === 'live2d-white-cat' ? (
                    <span
                      className={`pet-live2d-preview ${preset.id === 'live2d-white-cat' ? 'is-white' : 'is-black'}`}
                      aria-hidden="true"
                    >
                      猫
                    </span>
                  ) : (
                    <PetMascot kind={preset.id} className="pet-preset-svg" />
                  )}
                  <b>{preset.label}</b>
                </button>
              )
            })}
            <button
              type="button"
              className={`pet-preset-card pet-preset-photo${selectedKind === 'photo' ? ' is-on' : ''}`}
              aria-pressed={selectedKind === 'photo'}
              disabled={petBusy}
              onClick={() => {
                if (petBusy) return
                applyPet(
                  { ...form, petKind: 'photo', petAvatarId: form.petAvatarId },
                  '桌宠已换成我的Q版',
                )
              }}
            >
              <img src={qPreview ?? DEFAULT_Q_PET_SRC} alt="" />
              <b>{petBusy ? '生成中' : '我的Q版'}</b>
            </button>
          </div>
          <p className="settings-model-credit">
            Live2D 黑猫 Hijiki 与白猫 Tororo © Live2D Inc.，按官方样例条款使用。
          </p>
          <div className="settings-text-row">
            <button type="button" className="text-action" disabled={petBusy} onClick={() => petInputRef.current?.click()}>
              {form.petAvatarId ? '换一张照片' : '用照片生成'}
            </button>
            {form.petAvatarId ? (
              <button
                type="button"
                className="text-action"
                onClick={async () => {
                  await deleteResourceFile(PET_AVATAR_FILE_ID).catch(() => undefined)
                  setQPreview((current) => {
                    if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
                    return DEFAULT_Q_PET_SRC
                  })
                  applyPet({ ...form, petAvatarId: undefined, petKind: 'photo' }, '已换回默认Q版')
                }}
              >
                清除照片
              </button>
            ) : null}
          </div>
          <input
            ref={petInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (!file.type.startsWith('image/')) {
                notify.warning('请选择图片文件')
                return
              }
              void generateFromPhoto(file)
            }}
          />
        </section>
        )}

        {section === 'appearance' && (
        <section className="settings-block" aria-labelledby="settings-atmosphere">
          <h2 id="settings-atmosphere">背景</h2>
          <div className="atmosphere-grid">
            {ATMOSPHERE_PRESETS.map((preset) => {
              const selected = selectedAtmosphere === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`atmosphere-card${selected ? ' is-on' : ''}`}
                  aria-pressed={selected}
                  onClick={() => applyAtmosphere({ ...form, atmosphereId: preset.id }, `背景已换成${preset.label}`)}
                >
                  <img src={preset.src} alt="" />
                  <b>{preset.label}</b>
                </button>
              )
            })}
            <button
              type="button"
              className={`atmosphere-card atmosphere-card-photo${selectedAtmosphere === 'photo' ? ' is-on' : ''}${atmospherePreview ? '' : ' is-empty'}`}
              aria-pressed={selectedAtmosphere === 'photo'}
              onClick={() => {
                if (atmospherePreview) {
                  applyAtmosphere(
                    { ...form, atmosphereId: 'photo', atmosphereFileId: ATMOSPHERE_FILE_ID },
                    '背景已换成你的照片',
                  )
                  return
                }
                atmosphereInputRef.current?.click()
              }}
            >
              {atmospherePreview ? <img src={atmospherePreview} alt="" /> : null}
              <b>我的照片</b>
            </button>
          </div>
          <div className="settings-text-row">
            <button type="button" className="text-action" onClick={() => atmosphereInputRef.current?.click()}>
              {atmospherePreview ? '换一张照片' : '用自己的照片'}
            </button>
            {atmospherePreview ? (
              <button
                type="button"
                className="text-action"
                onClick={async () => {
                  await deleteResourceFile(ATMOSPHERE_FILE_ID).catch(() => undefined)
                  setAtmospherePreview((current) => {
                    if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
                    return null
                  })
                  applyAtmosphere({ ...form, atmosphereId: 'dusk', atmosphereFileId: undefined }, '已恢复黄昏背景')
                }}
              >
                清除照片
              </button>
            ) : null}
          </div>
          <input
            ref={atmosphereInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (!file.type.startsWith('image/')) {
                notify.warning('请选择图片文件')
                return
              }
              void saveAtmospherePhoto(file)
            }}
          />
        </section>
        )}

        {section === 'data' && (
        <section className="settings-block" aria-labelledby="settings-data">
          <h2 id="settings-data">本机数据</h2>
          <dl className="settings-location">
            <div>
              <dt>文件夹位置</dt>
              <dd>
                <code>{pathForDisplay(storageLocation.folderPath) || '当前浏览器未给出可打开的磁盘路径'}</code>
                {storageLocation.folderPath ? (
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => {
                      const path = storageLocation.folderPath
                      if (path) void copyTextValue(path, '文件夹位置')
                    }}
                  >
                    复制
                  </button>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>绑定网址</dt>
              <dd>
                <code>{storageLocation.origin || '—'}</code>
                {storageLocation.origin ? (
                  <button type="button" className="text-action" onClick={() => void copyTextValue(storageLocation.origin, '绑定网址')}>
                    复制
                  </button>
                ) : null}
              </dd>
            </div>
          </dl>
          <p className="settings-help">
            课件、照片、论文稿在这个文件夹。课表、学生、成绩写在同一配置的网页存储（{storageLocation.jsonKey}）。{storageLocation.folderHint}{' '}
            换浏览器、换网址或清除站点数据会找不到这份数据。
          </p>
          <div className="settings-actions">
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                persist(form, metaForm)
                downloadBackup()
              }}
            >
              导出备份
            </button>
            <button className="outline-action" type="button" onClick={() => fileRef.current?.click()}>
              导入备份
            </button>
          </div>
          <button
            className="settings-reset"
            type="button"
            onClick={async () => {
              try {
                await confirm.warning('当前本地数据将被覆盖。', '确定恢复为初始演示数据？', {
                  confirmButtonText: '恢复',
                  confirmButtonClass: 'danger',
                })
                onReset()
                notify.success('已恢复初始数据')
              } catch {
                /* cancelled */
              }
            }}
          >
            恢复初始数据
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              try {
                const text = await file.text()
                onImport(text)
                notify.success('备份已导入并覆盖本地数据')
              } catch {
                notify.error('导入失败：文件格式不正确')
              }
            }}
          />
        </section>
        )}
      </div>
    </section>
  )
}
