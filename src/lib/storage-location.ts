import { STORAGE_KEY } from '../data/store'
import { LLM_STORAGE_KEY } from './llm-settings'
import { FILES_DB_NAME } from './resource-files'

export type StorageLocation = {
  origin: string
  folderPath: string | null
  folderHint: string
  jsonKey: string
  filesDb: string
  llmKey: string
}

type BrowserFamily = 'chrome' | 'edge' | 'brave' | 'firefox' | 'safari' | 'other'
type OsFamily = 'mac' | 'win' | 'linux' | 'other'

function detectBrowser(ua: string): BrowserFamily {
  if (/Firefox\//.test(ua) || /FxiOS\//.test(ua)) return 'firefox'
  if (/Edg\//.test(ua) || /EdgiOS\//.test(ua)) return 'edge'
  if (/Brave/i.test(ua)) return 'brave'
  if (/Chrome\//.test(ua) || /CriOS\//.test(ua) || /Chromium\//.test(ua)) return 'chrome'
  if (/Safari\//.test(ua)) return 'safari'
  return 'other'
}

function detectOs(platform: string, ua: string): OsFamily {
  if (/iPhone|iPad|iPod/.test(platform) || /iPhone|iPad|iPod/.test(ua)) return 'other'
  if (/Mac/.test(platform) || /Mac OS X/.test(ua)) return 'mac'
  if (/Win/.test(platform) || /Windows/.test(ua)) return 'win'
  if (/Linux/.test(platform) || /Linux/.test(ua)) return 'linux'
  return 'other'
}

function chromiumOriginId(origin: string) {
  try {
    const url = new URL(origin)
    const protocol = url.protocol.replace(':', '')
    const isDefaultPort =
      !url.port ||
      (protocol === 'https' && url.port === '443') ||
      (protocol === 'http' && url.port === '80')
    const port = isDefaultPort ? '0' : url.port
    return `${protocol}_${url.hostname}_${port}`
  } catch {
    return ''
  }
}

function firefoxOriginId(origin: string) {
  try {
    const url = new URL(origin)
    const protocol = url.protocol.replace(':', '')
    return `${protocol}+++${url.host.replace(':', '+')}`
  } catch {
    return ''
  }
}

function joinPath(os: OsFamily, parts: string[]) {
  return parts.join(os === 'win' ? '\\' : '/')
}

function chromiumFolder(os: OsFamily, browser: Exclude<BrowserFamily, 'firefox' | 'safari' | 'other'>, originId: string) {
  const leaf = `${originId}.indexeddb.leveldb`
  if (os === 'mac') {
    const root =
      browser === 'edge'
        ? ['~', 'Library', 'Application Support', 'Microsoft Edge', 'Default', 'IndexedDB']
        : browser === 'brave'
          ? ['~', 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'Default', 'IndexedDB']
          : ['~', 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'IndexedDB']
    return joinPath(os, [...root, leaf])
  }
  if (os === 'win') {
    const root =
      browser === 'edge'
        ? ['%LOCALAPPDATA%', 'Microsoft', 'Edge', 'User Data', 'Default', 'IndexedDB']
        : browser === 'brave'
          ? ['%LOCALAPPDATA%', 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'IndexedDB']
          : ['%LOCALAPPDATA%', 'Google', 'Chrome', 'User Data', 'Default', 'IndexedDB']
    return joinPath(os, [...root, leaf])
  }
  if (os === 'linux') {
    const root =
      browser === 'edge'
        ? ['~', '.config', 'microsoft-edge', 'Default', 'IndexedDB']
        : browser === 'brave'
          ? ['~', '.config', 'BraveSoftware', 'Brave-Browser', 'Default', 'IndexedDB']
          : ['~', '.config', 'google-chrome', 'Default', 'IndexedDB']
    return joinPath(os, [...root, leaf])
  }
  return null
}

function firefoxFolder(os: OsFamily, originId: string) {
  if (!originId) return null
  if (os === 'mac') {
    return joinPath(os, ['~', 'Library', 'Application Support', 'Firefox', 'Profiles', '<配置>', 'storage', 'default', originId])
  }
  if (os === 'win') {
    return joinPath(os, ['%APPDATA%', 'Mozilla', 'Firefox', 'Profiles', '<配置>', 'storage', 'default', originId])
  }
  if (os === 'linux') {
    return joinPath(os, ['~', '.mozilla', 'firefox', '<配置>', 'storage', 'default', originId])
  }
  return null
}

export function describeStorageLocation(input?: { origin?: string; userAgent?: string; platform?: string }): StorageLocation {
  const origin = input?.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  const userAgent = input?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const platform = input?.platform ?? (typeof navigator !== 'undefined' ? navigator.platform : '')
  const browser = detectBrowser(userAgent)
  const os = detectOs(platform, userAgent)
  const originId = chromiumOriginId(origin)

  if (browser === 'safari') {
    return {
      origin,
      folderPath: os === 'mac' ? '~/Library/WebKit/WebsiteData/IndexedDB' : null,
      folderHint: 'Safari 不暴露精确子目录。可在设置 → 高级 → 显示网站数据里按当前网址查找。',
      jsonKey: STORAGE_KEY,
      filesDb: FILES_DB_NAME,
      llmKey: LLM_STORAGE_KEY,
    }
  }

  if (browser === 'firefox') {
    return {
      origin,
      folderPath: firefoxFolder(os, firefoxOriginId(origin)),
      folderHint: '配置目录是一段随机英文，在 Profiles 里选最近用过的那个。',
      jsonKey: STORAGE_KEY,
      filesDb: FILES_DB_NAME,
      llmKey: LLM_STORAGE_KEY,
    }
  }

  if (browser === 'chrome' || browser === 'edge' || browser === 'brave') {
    return {
      origin,
      folderPath: originId ? chromiumFolder(os, browser, originId) : null,
      folderHint: '按当前浏览器的默认配置估算；若开了多个用户，Default 可能要换成 Profile 1。',
      jsonKey: STORAGE_KEY,
      filesDb: FILES_DB_NAME,
      llmKey: LLM_STORAGE_KEY,
    }
  }

  return {
    origin,
    folderPath: null,
    folderHint: '当前浏览器无法从页面读出磁盘路径。数据仍只留在这台电脑的这个网址下。',
    jsonKey: STORAGE_KEY,
    filesDb: FILES_DB_NAME,
    llmKey: LLM_STORAGE_KEY,
  }
}
