import { useEffect, useRef, useState } from 'react'
import type { TeacherProfile, WorkbenchMeta } from '../data/types'
import { thisMondayIso } from '../lib/dates'
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
  onAlignWeek?: () => void
}

export function SettingsPage({ profile, meta, updatedAt, onSaveProfile, onExport, onImport, onReset, onAlignWeek }: Props) {
  const [form, setForm] = useState(profile)
  const [metaForm, setMetaForm] = useState(meta)
  const fileRef = useRef<HTMLInputElement>(null)
  const petInputRef = useRef<HTMLInputElement>(null)
  const sourceFile = useRef<File | null>(null)
  const [sourcePreview, setSourcePreview] = useState<string | null>(null)
  const [qPreview, setQPreview] = useState<string | null>(null)
  const [petBusy, setPetBusy] = useState(false)
  const [hasSource, setHasSource] = useState(false)

  useEffect(() => {
    let url: string | null = null
    if (!profile.petAvatarId) return undefined
    void getResourceFile(profile.petAvatarId).then((stored) => {
      if (!stored) return
      url = URL.createObjectURL(stored.blob)
      setQPreview(url)
    })
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [profile.petAvatarId])

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    onSaveProfile(form, metaForm)
    notify.success('个人资料与学期设置已保存到本机')
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

  return (
    <section className="settings-page" aria-label="设置与备份">
      <div className="settings-heading">
        <p className="section-label">本机设置</p>
        <h1>设置与备份</h1>
        <p>资料、学期与备份都保存在本机浏览器</p>
      </div>
      <form className="settings-card" onSubmit={save}>
        <p className="section-label">教师资料</p>
        <div className="settings-grid">
          <label>
            姓名
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, greetingName: `${e.target.value}老师` })} required />
          </label>
          <label>
            职称
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            学院
            <input value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} />
          </label>
          <label>
            称呼
            <input value={form.greetingName} onChange={(e) => setForm({ ...form, greetingName: e.target.value })} />
          </label>
        </div>
        <p className="section-label">学期信息</p>
        <div className="settings-grid">
          <label>
            学期名称
            <input value={metaForm.termLabel} onChange={(e) => setMetaForm({ ...metaForm, termLabel: e.target.value })} />
          </label>
          <label>
            当前教学周
            <input
              type="number"
              min={1}
              max={22}
              value={metaForm.weekNumber}
              onChange={(e) => setMetaForm({ ...metaForm, weekNumber: Number(e.target.value) })}
            />
          </label>
          <label>
            本周起始日
            <input type="date" value={metaForm.weekStart} onChange={(e) => setMetaForm({ ...metaForm, weekStart: e.target.value })} />
          </label>
        </div>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={metaForm.demoBanner}
            onChange={(event) => setMetaForm({ ...metaForm, demoBanner: event.target.checked })}
          />
          演示模式：概览按真实今天显示；重置数据时日程对齐到本周
        </label>
        {onAlignWeek && (
          <button
            className="outline-action"
            type="button"
            onClick={() => {
              onAlignWeek()
              setMetaForm((current) => ({ ...current, weekStart: thisMondayIso(), demoBanner: true }))
              notify.success('演示日程已对齐到本周，概览将显示今天的安排')
            }}
          >
            将演示日程对齐到本周
          </button>
        )}
        <button className="primary-action" type="submit">
          保存设置
        </button>
      </form>

      <section className="settings-card">
        <p className="section-label">桌面宠物形象</p>
        <p className="settings-help">
          点选软萌伙伴，或上传正面照片生成本机 Q 版大头。图片不会离开这台电脑。
        </p>
        <div className="pet-preset-grid">
          {PET_PRESETS.map((preset) => {
            const selected = resolvePetKind(form) === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                className={`pet-preset-card${selected ? ' is-on' : ''}`}
                onClick={() => {
                  const nextProfile = { ...form, petKind: preset.id }
                  setForm(nextProfile)
                  onSaveProfile(nextProfile, metaForm)
                  notify.success(`桌宠已换成${preset.label}`)
                }}
              >
                <PetMascot kind={preset.id} className="pet-preset-svg" />
                <b>{preset.label}</b>
                <span>{preset.hint}</span>
              </button>
            )
          })}
          {qPreview && (
            <button
              type="button"
              className={`pet-preset-card pet-preset-photo${resolvePetKind(form) === 'photo' ? ' is-on' : ''}`}
              onClick={() => {
                const nextProfile = { ...form, petKind: 'photo' as const, petAvatarId: PET_AVATAR_FILE_ID }
                setForm(nextProfile)
                onSaveProfile(nextProfile, metaForm)
                notify.success('桌宠已换成我的Q版')
              }}
            >
              <img src={qPreview} alt="我的Q版" />
              <b>我的Q版</b>
              <span>照片生成</span>
            </button>
          )}
        </div>
        <p className="section-label">用照片生成 Q 版</p>
        <div className="pet-maker">
          <label className="pet-maker-preview">
            <span>原图</span>
            {sourcePreview ? <img src={sourcePreview} alt="待生成的原图" /> : <em>还没有选择照片</em>}
          </label>
          <label className="pet-maker-preview">
            <span>Q 版大头</span>
            {qPreview ? <img src={qPreview} alt="生成的 Q 版大头" /> : <em>生成后显示在这里</em>}
          </label>
        </div>
        <div className="settings-actions">
          <button className="outline-action" type="button" onClick={() => petInputRef.current?.click()}>
            选择照片
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={petBusy || !hasSource}
            onClick={async () => {
              const file = sourceFile.current
              if (!file) {
                notify.warning('请先选择一张照片')
                return
              }
              setPetBusy(true)
              try {
                const blob = await generateQPetSprite(file)
                await saveGeneratedPet(blob)
                const url = URL.createObjectURL(blob)
                setQPreview((current) => {
                  if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
                  return url
                })
                const nextProfile = { ...form, petAvatarId: PET_AVATAR_FILE_ID, petKind: 'photo' as const }
                setForm(nextProfile)
                onSaveProfile(nextProfile, metaForm)
                notify.success('Q 版大头已生成，桌宠会换成新样子')
              } catch (error) {
                notify.error(error instanceof Error ? error.message : '生成失败')
              } finally {
                setPetBusy(false)
              }
            }}
          >
            {petBusy ? '正在生成…' : '生成 Q 版'}
          </button>
          <button
            className="outline-action"
            type="button"
            onClick={async () => {
              await deleteResourceFile(PET_AVATAR_FILE_ID).catch(() => undefined)
              const nextProfile = { ...form, petAvatarId: undefined, petKind: 'ning' as const }
              setForm(nextProfile)
              setQPreview(null)
              onSaveProfile(nextProfile, metaForm)
              notify.info('已恢复默认桌宠小宁')
            }}
          >
            恢复默认
          </button>
        </div>
        <input
          ref={petInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            if (!file.type.startsWith('image/')) {
              notify.warning('请选择图片文件')
              return
            }
            sourceFile.current = file
            setHasSource(true)
            setSourcePreview((current) => {
              if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
              return URL.createObjectURL(file)
            })
            event.target.value = ''
          }}
        />
      </section>

      <section className="settings-card">
        <p className="section-label">数据备份</p>
        <p className="settings-help">最近更新：{new Date(updatedAt).toLocaleString('zh-CN')}</p>
        <div className="settings-actions">
          <button className="primary-action" type="button" onClick={downloadBackup}>
            导出全部数据
          </button>
          <button className="outline-action" type="button" onClick={() => fileRef.current?.click()}>
            从备份恢复
          </button>
          <button
            className="danger-action"
            type="button"
            onClick={async () => {
              try {
                await confirm.warning('当前本地数据将被覆盖。', '确定恢复为初始演示数据？', {
                  confirmButtonText: '恢复',
                  confirmButtonClass: 'danger',
                })
                onReset()
                notify.success('已恢复初始演示数据')
              } catch {
                /* cancelled */
              }
            }}
          >
            重置演示数据
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            try {
              const text = await file.text()
              onImport(text)
              notify.success('备份已导入并覆盖本地数据')
            } catch {
              notify.error('导入失败：文件格式不正确')
            }
            event.target.value = ''
          }}
        />
      </section>

      <section className="settings-card">
        <p className="section-label">安装为应用</p>
        <p className="settings-help">
          本工作台是 PWA。在 Chrome / Edge / Safari 中可通过「安装应用」或「添加到主屏幕」离线使用。数据始终留在本机，不会上传到服务器。
        </p>
      </section>
    </section>
  )
}
