import { useEffect, useState } from 'react'
import type { AtmosphereId, TeacherProfile } from '../data/types'
import { getResourceFile } from './resource-files'

export const ATMOSPHERE_FILE_ID = 'atmosphere-photo'

export const ATMOSPHERE_PRESETS: { id: Exclude<AtmosphereId, 'photo'>; label: string; src: string; position: string }[] = [
  { id: 'dusk', label: '黄昏', src: '/glass-sky.jpg', position: 'center' },
  { id: 'grove', label: '林荫', src: '/glass-grove.jpg', position: 'center 72%' },
  { id: 'rain', label: '雨后', src: '/glass-rain.jpg', position: 'center 60%' },
]

export function resolveAtmosphereId(profile: Pick<TeacherProfile, 'atmosphereId' | 'atmosphereFileId'>): AtmosphereId {
  if (profile.atmosphereId) return profile.atmosphereId
  if (profile.atmosphereFileId) return 'photo'
  return 'dusk'
}

export function atmospherePreset(kind: AtmosphereId) {
  if (kind === 'photo') return { src: '', position: 'center' }
  return ATMOSPHERE_PRESETS.find((row) => row.id === kind) ?? ATMOSPHERE_PRESETS[0]
}

export function useAtmosphereSrc(profile: Pick<TeacherProfile, 'atmosphereId' | 'atmosphereFileId'>) {
  const kind = resolveAtmosphereId(profile)
  const preset = atmospherePreset(kind)
  const [src, setSrc] = useState(preset.src || '/glass-sky.jpg')

  useEffect(() => {
    let blobUrl: string | null = null
    let cancelled = false
    if (kind !== 'photo' || !profile.atmosphereFileId) {
      setSrc(preset.src || '/glass-sky.jpg')
      return undefined
    }
    void getResourceFile(profile.atmosphereFileId).then((stored) => {
      if (cancelled) return
      if (!stored) {
        setSrc('/glass-sky.jpg')
        return
      }
      blobUrl = URL.createObjectURL(stored.blob)
      setSrc(blobUrl)
    })
    return () => {
      cancelled = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [kind, preset.src, profile.atmosphereFileId])

  return { src, position: kind === 'photo' ? 'center' : preset.position }
}
