import { useEffect, useRef, useState } from 'react'
import type { TeacherProfile, WorkbenchMeta } from '../data/types'
import { thisMondayIso, termWeekOf } from '../lib/dates'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'
import { deleteResourceFile, getResourceFile } from '../lib/resource-files'
import { generateQPetSprite, PET_AVATAR_FILE_ID, saveGeneratedPet } from '../lib/q-pet'
import { PET_PRESETS, resolvePetKind } from '../lib/pet-kind'
import { PetMascot } from '../components/PetMascots'

type Props = {
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
    a.petAvatarId === b.petAvatarId
  )
}

function sameMeta(a: WorkbenchMeta, b: WorkbenchMeta) {
  return a.termLabel === b.termLabel && a.weekNumber === b.weekNumber && a.weekStart === b.weekStart
}

export function SettingsPage({ profile, meta, updatedAt, onSaveProfile, onExport, onImport, onReset }: Props) {
  const [form, setForm] = useState(() => withGreeting(profile))
  const [metaForm, setMetaForm] = useState(() => liveMeta(meta))
  const fileRef = useRef<HTMLInputElement>(null)
  const petInputRef = useRef<HTMLInputElement>(null)
  const [qPreview, setQPreview] = useState<string | null>(null)
  const [petBusy, setPetBusy] = useState(false)

  useEffect(() => {
    setForm(withGreeting(profile))
    setMetaForm(liveMeta(meta))
  }, [updatedAt]) // 导入/重置后整页对齐；输入过程不回写，避免冲掉未失焦的修改

  useEffect(() => {
    let url: string | null = null
    if (!profile.petAvatarId) {
      setQPreview(null)
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

  const selectedKind = resolvePetKind(form)

  return (
    <section className="settings-page" aria-label="设置">
      <div className="settings-heading">
        <h1>设置</h1>
        <p>改完即存。数据只留在这台电脑。</p>
      </div>

      <div className="settings-stack">
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

        <section className="settings-block" aria-labelledby="settings-pet">
          <h2 id="settings-pet">桌宠</h2>
          <p className="settings-help">点一下就换。照片在本机生成 Q 版，不会上传。</p>
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
                  <PetMascot kind={preset.id} className="pet-preset-svg" />
                  <b>{preset.label}</b>
                </button>
              )
            })}
            <button
              type="button"
              className={`pet-preset-card pet-preset-photo${selectedKind === 'photo' ? ' is-on' : ''}${qPreview ? '' : ' is-empty'}`}
              aria-pressed={selectedKind === 'photo'}
              disabled={petBusy}
              onClick={() => {
                if (petBusy) return
                if (qPreview) {
                  applyPet({ ...form, petKind: 'photo', petAvatarId: PET_AVATAR_FILE_ID }, '桌宠已换成我的Q版')
                  return
                }
                petInputRef.current?.click()
              }}
            >
              {qPreview ? <img src={qPreview} alt="" /> : null}
              <b>{petBusy ? '生成中' : '我的Q版'}</b>
            </button>
          </div>
          <div className="settings-text-row">
            <button type="button" className="text-action" disabled={petBusy} onClick={() => petInputRef.current?.click()}>
              {qPreview ? '换一张照片' : '用照片生成'}
            </button>
            {qPreview ? (
              <button
                type="button"
                className="text-action"
                onClick={async () => {
                  await deleteResourceFile(PET_AVATAR_FILE_ID).catch(() => undefined)
                  setQPreview((current) => {
                    if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
                    return null
                  })
                  applyPet({ ...form, petAvatarId: undefined, petKind: 'ning' }, '已恢复默认桌宠小宁')
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

        <section className="settings-block" aria-labelledby="settings-data">
          <h2 id="settings-data">本机数据</h2>
          <p className="settings-help">全部留在这台电脑。换电脑前先导出一份。</p>
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
      </div>
    </section>
  )
}
