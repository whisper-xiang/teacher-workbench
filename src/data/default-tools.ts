import type { NativeToolId, ToolCategory, ToolItem } from './types'

/** 预置工具清单版本。升高后会按 id 补齐本机工具与新入口，并撤掉已退役的预置外链。 */
export const PRESET_TOOLS_VERSION = 4

export const TOOL_CATEGORIES: ToolCategory[] = ['文献与平台', '课堂与教务', '我的入口']

export const NATIVE_TOOL_IDS = ['native-rollcall', 'native-gradesim'] as const

/** 旧版导航站预置，升级时按 id 移除；老师自建的其他 id 会保留。 */
const RETIRED_PRESET_IDS = new Set([
  'moe',
  'jyb',
  'cnsece',
  'cse',
  'canva',
  'xmind',
  'gamma',
  'fanya',
  'meeting',
  'dingtalk',
  'scholar',
  'spss',
  'nvivo',
  'docs',
  'ev',
  'smallpdf',
  'shimo',
  'chatgpt',
  'yiyan',
  'tongyi',
  'kimi',
  'doubao',
  'metaso',
])

const LEGACY_CATEGORY: Record<string, ToolCategory> = {
  政策与学会: '文献与平台',
  学术工具: '文献与平台',
  研究与写作: '文献与平台',
  备课工具: '课堂与教务',
  教学平台: '课堂与教务',
  备课与课堂: '课堂与教务',
  效率工具: '课堂与教务',
  AI工具: '我的入口',
  协作与事务: '我的入口',
}

export function migrateToolCategory(category: string): ToolCategory {
  if ((TOOL_CATEGORIES as readonly string[]).includes(category)) return category as ToolCategory
  return LEGACY_CATEGORY[category] ?? '我的入口'
}

export function isNativeTool(tool: ToolItem): tool is ToolItem & { kind: 'native'; nativeId: NativeToolId } {
  return tool.kind === 'native' && (tool.nativeId === 'rollcall' || tool.nativeId === 'gradesim')
}

export function nativeToolByParam(tools: ToolItem[], param?: string) {
  if (!param) return undefined
  return tools.find((tool) => isNativeTool(tool) && (tool.nativeId === param || tool.id === param))
}

export function normalizeToolItem(item: ToolItem): ToolItem {
  const nativeId = item.nativeId === 'rollcall' || item.nativeId === 'gradesim' ? item.nativeId : undefined
  return {
    ...item,
    category: migrateToolCategory(item.category),
    kind: nativeId ? 'native' : 'link',
    nativeId,
  }
}

const NATIVE_TOOLS: ToolItem[] = [
  {
    id: 'native-rollcall',
    name: '随机点名 / 分组',
    description: '花名册抽签点名，也可随机分组；结果可复制，不改名单',
    category: '课堂与教务',
    initials: '点',
    tone: 'teal',
    kind: 'native',
    nativeId: 'rollcall',
    typeLabel: '本机',
    tags: ['花名册', '课堂'],
  },
  {
    id: 'native-gradesim',
    name: '总评试算',
    description: '调整平时 / 期中 / 期末权重，预览等级；确认后再写入总评',
    category: '课堂与教务',
    initials: '评',
    tone: 'navy',
    kind: 'native',
    nativeId: 'gradesim',
    typeLabel: '本机',
    tags: ['成绩', '等级'],
  },
]

export const DEFAULT_TOOLS: ToolItem[] = [
  ...NATIVE_TOOLS,
  {
    id: 'cnki',
    name: '中国知网 CNKI',
    description: '期刊、硕博与会议论文检索',
    category: '文献与平台',
    initials: '知',
    tone: 'navy',
    url: 'https://www.cnki.net',
    tags: ['文献', '论文'],
    typeLabel: '网页',
    kind: 'link',
  },
  {
    id: 'wanfang',
    name: '万方数据',
    description: '期刊、学位论文与会议论文综合检索',
    category: '文献与平台',
    initials: '万',
    tone: 'blue',
    url: 'https://www.wanfangdata.com.cn',
    tags: ['文献'],
    typeLabel: '网页',
    kind: 'link',
  },
  {
    id: 'eric',
    name: 'ERIC',
    description: '美国教育部教育学文献库',
    category: '文献与平台',
    initials: 'E',
    tone: 'gold',
    url: 'https://eric.ed.gov',
    tags: ['英文', '教育学'],
    typeLabel: '网页',
    kind: 'link',
  },
  {
    id: 'zotero',
    name: 'Zotero 文献管理',
    description: '收藏文献并生成参考文献格式',
    category: '文献与平台',
    initials: 'Z',
    tone: 'gold',
    url: 'https://www.zotero.org',
    tags: ['文献管理'],
    typeLabel: '桌面/插件',
    kind: 'link',
  },
  {
    id: 'ece-journal',
    name: '学前教育研究',
    description: '学前教育核心期刊，关注幼儿园课程与儿童发展',
    category: '文献与平台',
    initials: '刊',
    tone: 'violet',
    url: 'https://c.wanfangdata.com.cn/periodical/xqjyyj',
    tags: ['学前', '期刊'],
    typeLabel: '网页',
    kind: 'link',
  },
  {
    id: 'smartedu',
    name: '国家智慧教育平台',
    description: '国家中小学 / 职业教育智慧教育公共服务平台',
    category: '课堂与教务',
    initials: '智',
    tone: 'teal',
    url: 'https://www.smartedu.cn',
    tags: ['课例', '国家平台'],
    typeLabel: '网页',
    kind: 'link',
  },
  {
    id: 'pep',
    name: '人民教育出版社',
    description: '中小学教材、教师用书与课标配套资源',
    category: '课堂与教务',
    initials: '人',
    tone: 'green',
    url: 'https://www.pep.com.cn',
    tags: ['教材', '课标'],
    typeLabel: '网页',
    kind: 'link',
  },
  {
    id: 'yuketang',
    name: '雨课堂',
    description: '课件推送、随堂测验与课堂互动',
    category: '课堂与教务',
    initials: '雨',
    tone: 'blue',
    url: 'https://www.yuketang.cn',
    tags: ['课堂互动'],
    typeLabel: '网页',
    kind: 'link',
  },
  {
    id: 'chaoxing',
    name: '学习通',
    description: '课程、签到、作业与考试',
    category: '课堂与教务',
    initials: '学',
    tone: 'teal',
    url: 'https://www.chaoxing.com',
    tags: ['课程管理'],
    typeLabel: '网页',
    kind: 'link',
  },
  {
    id: 'mooc',
    name: '中国大学 MOOC',
    description: '国家级在线课程，可引用一流课程资源',
    category: '课堂与教务',
    initials: '慕',
    tone: 'navy',
    url: 'https://www.icourse163.org',
    tags: ['MOOC'],
    typeLabel: '网页',
    kind: 'link',
  },
  {
    id: 'wjx',
    name: '问卷星',
    description: '学情调研、课程评价与问卷分发',
    category: '课堂与教务',
    initials: '问',
    tone: 'green',
    url: 'https://www.wjx.cn',
    tags: ['问卷'],
    typeLabel: '网页',
    kind: 'link',
  },
]

export const DEFAULT_FAVORITE_TOOL_IDS = ['native-rollcall', 'cnki', 'smartedu', 'zotero']

export function mergePresetTools(existing: ToolItem[] | undefined, presets = DEFAULT_TOOLS): ToolItem[] {
  if (!existing?.length) return ensureNativeTools(presets.map(normalizeToolItem), presets)
  const presetById = new Map(presets.map((item) => [item.id, item]))
  const have = new Set(existing.map((item) => item.id))
  const merged = existing
    .filter((item) => !RETIRED_PRESET_IDS.has(item.id))
    .map((item) => {
      const preset = presetById.get(item.id)
      if (preset?.kind === 'native') {
        return normalizeToolItem({ ...preset, lastUsedAt: item.lastUsedAt })
      }
      if (!preset) return normalizeToolItem({ ...item, kind: 'link' })
      return normalizeToolItem({
        ...item,
        icon: item.icon ?? preset.icon,
        kind: 'link',
        typeLabel: item.typeLabel ?? preset.typeLabel,
        tags: item.tags ?? preset.tags,
      })
    })
  const missing = presets.filter((item) => !have.has(item.id) && item.kind !== 'native')
  return ensureNativeTools(missing.length ? [...merged, ...missing.map(normalizeToolItem)] : merged, presets)
}

export function ensureNativeTools(tools: ToolItem[], presets = DEFAULT_TOOLS): ToolItem[] {
  const natives = presets.filter(isNativeTool)
  const lastUsed = new Map(tools.filter(isNativeTool).map((item) => [item.id, item.lastUsedAt]))
  const rest = tools.filter((item) => !isNativeTool(item)).map(normalizeToolItem)
  return [
    ...natives.map((item) => normalizeToolItem({ ...item, lastUsedAt: lastUsed.get(item.id) })),
    ...rest,
  ]
}
