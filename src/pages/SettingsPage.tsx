import { useRef, useState } from 'react'
import type { TeacherProfile, WorkbenchMeta } from '../data/types'
import { notify } from '../lib/notify'
import { confirm } from '../lib/confirm'

type Props = {
  profile: TeacherProfile
  meta: WorkbenchMeta
  updatedAt: string
  onSaveProfile: (profile: TeacherProfile, meta: WorkbenchMeta) => void
  onExport: () => string
  onImport: (json: string) => void
  onReset: () => void
}

export function SettingsPage({ profile, meta, updatedAt, onSaveProfile, onExport, onImport, onReset }: Props) {
  const [form, setForm] = useState(profile)
  const [metaForm, setMetaForm] = useState(meta)
  const fileRef = useRef<HTMLInputElement>(null)

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    onSaveProfile(form, { ...metaForm, demoBanner: false })
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
        <button className="primary-action" type="submit">
          保存设置
        </button>
      </form>

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
