export type LlmSettings = {
  baseUrl: string
  apiKey: string
  model: string
}

export const LLM_STORAGE_KEY = 'teacher-workbench-llm-v1'

export const EMPTY_LLM: LlmSettings = {
  baseUrl: '',
  apiKey: '',
  model: '',
}

function isSettings(value: unknown): value is LlmSettings {
  return Boolean(value && typeof value === 'object' && 'baseUrl' in value && 'apiKey' in value && 'model' in value)
}

export function loadLlmSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(LLM_STORAGE_KEY)
    if (!raw) return { ...EMPTY_LLM }
    const parsed = JSON.parse(raw) as unknown
    if (!isSettings(parsed)) return { ...EMPTY_LLM }
    return {
      baseUrl: String(parsed.baseUrl ?? '').trim(),
      apiKey: String(parsed.apiKey ?? '').trim(),
      model: String(parsed.model ?? '').trim(),
    }
  } catch {
    return { ...EMPTY_LLM }
  }
}

export function saveLlmSettings(settings: LlmSettings) {
  const next: LlmSettings = {
    baseUrl: settings.baseUrl.trim(),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
  }
  localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(next))
}

export function hasLlmSettings(settings = loadLlmSettings()) {
  return Boolean(settings.baseUrl && settings.apiKey && settings.model)
}
