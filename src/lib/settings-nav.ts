export const SETTINGS_SECTIONS = [
  { id: 'profile', label: '个人信息', icon: 'person' },
  { id: 'appearance', label: '外观', icon: 'appearance' },
  { id: 'data', label: '数据', icon: 'data' },
  { id: 'model', label: '模型配置', icon: 'model' },
  { id: 'pet', label: '桌面宠物', icon: 'pet' },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'profile'

export function isSettingsSection(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((item) => item.id === value)
}

export function parseSettingsSection(value?: string): SettingsSectionId {
  return value && isSettingsSection(value) ? value : DEFAULT_SETTINGS_SECTION
}
