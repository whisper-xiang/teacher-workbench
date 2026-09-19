import { THESIS_STAGES, type ThesisAdvisee, type ThesisStage } from '../data/types'
import { completeChat } from './llm-chat'

export function evidenceByStage(person: ThesisAdvisee, stage: ThesisStage) {
  return (person.evidence ?? []).filter((item) => item.stage === stage)
}

export function buildThesisRecordFallback(person: ThesisAdvisee, teacherName: string) {
  const lines = [
    '本科毕业论文指导记录',
    '',
    `学生：${person.name}`,
    `题目：${person.topic.trim() || '未定题'}`,
    `当前阶段：${person.stage}`,
    `指导教师：${teacherName || '（未填）'}`,
    `整理日期：${new Date().toISOString().slice(0, 10)}`,
    '',
    '一、指导过程',
  ]
  const notes = [...person.notes].sort((a, b) => a.date.localeCompare(b.date))
  if (!notes.length) lines.push('（暂无已写入的指导意见）')
  for (const note of notes) {
    lines.push(`${note.date} · ${note.stage}`)
    lines.push(note.text.trim())
    lines.push('')
  }
  lines.push('二、证明材料清单')
  for (const stage of THESIS_STAGES) {
    const files = evidenceByStage(person, stage)
    if (!files.length) continue
    lines.push(`【${stage}】`)
    for (const file of files) {
      lines.push(`- ${file.uploadedAt} ${file.fileName}${file.note ? `（${file.note}）` : ''}`)
    }
  }
  if (!(person.evidence ?? []).length) lines.push('（尚未上传佐证资料）')
  const drafts = person.drafts ?? []
  if (drafts.length) {
    lines.push('')
    lines.push('三、文稿往来')
    for (const draft of drafts) {
      lines.push(`- ${draft.receivedAt} ${draft.fileName}`)
    }
  }
  return lines.join('\n').trim() + '\n'
}

export async function generateThesisRecord(person: ThesisAdvisee, teacherName: string) {
  const fallback = buildThesisRecordFallback(person, teacherName)
  const raw = await completeChat({
    system: '你是师范院校教育学院讲师的论文指导助手。根据老师已有的意见和佐证清单，整理一份可提交学院的本科毕业论文指导记录。不编造没出现过的会面、分数或材料。只返回正文，不要 markdown 代码块。',
    user: [
      '请写成正式、简洁的指导记录，包含：学生与题目、各阶段指导要点、证明材料对照。口吻是指导教师。',
      fallback,
    ].join('\n\n'),
    temperature: 0.2,
  })
  return raw.replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/, '').trim() + '\n'
}

export function downloadTextFile(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || '指导记录.txt'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
