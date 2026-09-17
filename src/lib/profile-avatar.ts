import { useEffect, useState } from 'react'
import { getResourceFile, putResourceFile } from './resource-files'

export const PROFILE_AVATAR_FILE_ID = 'profile-avatar'
export const PROFILE_AVATAR_EVENT = 'profile-avatar-change'

const OUTPUT = 320

function loadImage(src: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(src)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取图片'))
    }
    img.src = url
  })
}

export async function prepareProfileAvatar(file: Blob): Promise<Blob> {
  const img = await loadImage(file)
  const side = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT
  canvas.height = OUTPUT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法处理头像')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, OUTPUT, OUTPUT)
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('头像处理失败'))
        else resolve(blob)
      },
      'image/jpeg',
      0.9,
    )
  })
}

export async function saveProfileAvatar(file: Blob) {
  const prepared = await prepareProfileAvatar(file)
  await putResourceFile(PROFILE_AVATAR_FILE_ID, prepared, 'avatar.jpg')
  window.dispatchEvent(new Event(PROFILE_AVATAR_EVENT))
  return PROFILE_AVATAR_FILE_ID
}

export function profileAvatarInitial(name: string) {
  return name.trim().slice(0, 1) || '师'
}

export function useProfileAvatarSrc(fileId?: string) {
  const [src, setSrc] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener(PROFILE_AVATAR_EVENT, bump)
    return () => window.removeEventListener(PROFILE_AVATAR_EVENT, bump)
  }, [])

  useEffect(() => {
    let blobUrl: string | null = null
    let cancelled = false
    if (!fileId) {
      setSrc(null)
      return undefined
    }
    void getResourceFile(fileId).then((stored) => {
      if (cancelled) return
      if (!stored) {
        setSrc(null)
        return
      }
      blobUrl = URL.createObjectURL(stored.blob)
      setSrc(blobUrl)
    })
    return () => {
      cancelled = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [fileId, tick])

  return src
}
