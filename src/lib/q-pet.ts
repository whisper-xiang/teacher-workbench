import { putResourceFile } from './resource-files'

export const PET_AVATAR_FILE_ID = 'pet-q-avatar'
export const PET_AVATAR_EVENT = 'pet-avatar-change'

const OUTPUT = 512

function loadImage(src: Blob | string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    const url = typeof src === 'string' ? src : URL.createObjectURL(src)
    img.onload = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url)
      reject(new Error('无法读取图片'))
    }
    img.src = url
  })
}

type Box = { x: number; y: number; w: number; h: number }

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function isSkin(r: number, g: number, b: number) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return y > 60 && y < 250 && cb > 77 && cb < 145 && cr > 125 && cr < 185 && r > g - 8 && g > b - 20
}

function defaultHeadBox(img: HTMLImageElement): Box {
  const side = Math.min(img.width, img.height) * 0.72
  return {
    x: (img.width - side) / 2,
    y: Math.max(0, img.height * 0.08),
    w: side,
    h: side,
  }
}

function expandToSquare(box: Box, img: HTMLImageElement, pad = 0.32): Box {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h * 0.38
  const side = Math.max(box.w, box.h) * (1 + pad)
  const x = clamp(cx - side / 2, 0, Math.max(0, img.width - 8))
  const y = clamp(cy - side / 2, 0, Math.max(0, img.height - 8))
  const w = Math.min(side, img.width - x)
  const h = Math.min(side, img.height - y)
  const size = Math.min(w, h)
  return { x, y, w: size, h: size }
}

async function detectHeadBox(img: HTMLImageElement): Promise<Box> {
  const FaceDetectorCtor = (window as Window & { FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => { detect: (source: HTMLImageElement) => Promise<{ boundingBox: DOMRectReadOnly }[]> } }).FaceDetector
  if (FaceDetectorCtor) {
    try {
      const faces = await new FaceDetectorCtor({ fastMode: false, maxDetectedFaces: 1 }).detect(img)
      const face = faces[0]?.boundingBox
      if (face && face.width > 12) {
        return expandToSquare({ x: face.x, y: face.y, w: face.width, h: face.height }, img, 0.34)
      }
    } catch {
      /* fallback */
    }
  }
  return expandToSquare(skinHeadBox(img) ?? defaultHeadBox(img), img, 0.22)
}

function skinHeadBox(img: HTMLImageElement): Box | null {
  const sample = document.createElement('canvas')
  const scale = Math.min(1, 160 / Math.max(img.width, img.height))
  sample.width = Math.max(8, Math.round(img.width * scale))
  sample.height = Math.max(8, Math.round(img.height * scale))
  const ctx = sample.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, sample.width, sample.height)
  const { data, width, height } = ctx.getImageData(0, 0, sample.width, sample.height)
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let count = 0
  const limitY = Math.floor(height * 0.78)
  for (let y = 0; y < limitY; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (!isSkin(data[i], data[i + 1], data[i + 2])) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      count++
    }
  }
  if (count < width * height * 0.02) return null
  const pad = 6
  return {
    x: (minX - pad) / scale,
    y: (minY - pad) / scale,
    w: (maxX - minX + pad * 2) / scale,
    h: (maxY - minY + pad * 2) / scale,
  }
}

function softenPortrait(image: ImageData) {
  const { data, width, height } = image
  const copy = new Uint8ClampedArray(data)
  const radius = 2
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const i = (y * width + x) * 4
      if (!isSkin(copy[i], copy[i + 1], copy[i + 2])) continue
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const j = ((y + dy) * width + (x + dx)) * 4
          r += copy[j]
          g += copy[j + 1]
          b += copy[j + 2]
          n++
        }
      }
      data[i] = Math.round(copy[i] * 0.42 + r / n * 0.58)
      data[i + 1] = Math.round(copy[i + 1] * 0.42 + g / n * 0.58)
      data[i + 2] = Math.round(copy[i + 2] * 0.42 + b / n * 0.58)
    }
  }
  return image
}

function liftPortrait(image: ImageData) {
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    const contrast = 0.96
    const sat = 1.12
    let nr = (r - 128) * contrast + 128
    let ng = (g - 128) * contrast + 128
    let nb = (b - 128) * contrast + 128
    nr = gray + (nr - gray) * sat + 18
    ng = gray + (ng - gray) * sat + 10
    nb = gray + (nb - gray) * sat + 6
    data[i] = clamp(nr, 0, 255)
    data[i + 1] = clamp(ng, 0, 255)
    data[i + 2] = clamp(nb, 0, 255)
  }
  return image
}

function paintBlush(ctx: CanvasRenderingContext2D, size: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  ctx.fillStyle = '#f7b8b4'
  ctx.beginPath()
  ctx.ellipse(size * 0.26, size * 0.62, size * 0.12, size * 0.07, 0, 0, Math.PI * 2)
  ctx.ellipse(size * 0.74, size * 0.62, size * 0.12, size * 0.07, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.fillStyle = '#fff8f4'
  ctx.beginPath()
  ctx.ellipse(size * 0.38, size * 0.32, size * 0.18, size * 0.12, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** 本机裁出人脸，做成软萌 Q 版圆形大头立绘（不上传） */
export async function generateQPetSprite(file: Blob): Promise<Blob> {
  const img = await loadImage(file)
  const head = await detectHeadBox(img)
  const face = OUTPUT
  const width = 512
  const height = 680
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法生成 Q 版形象')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const portrait = document.createElement('canvas')
  portrait.width = face
  portrait.height = face
  const pctx = portrait.getContext('2d', { willReadFrequently: true })
  if (!pctx) throw new Error('无法生成 Q 版形象')
  pctx.imageSmoothingEnabled = true
  pctx.imageSmoothingQuality = 'high'
  const zoom = 1.16
  const drawn = face * zoom
  const offset = (face - drawn) / 2
  pctx.drawImage(img, head.x, head.y, head.w, head.h, offset, offset, drawn, drawn)
  pctx.putImageData(liftPortrait(softenPortrait(pctx.getImageData(0, 0, face, face))), 0, 0)
  paintBlush(pctx, face)

  const cx = width / 2
  const headY = 236
  const headR = 196

  ctx.fillStyle = '#ffd4c8'
  ctx.beginPath()
  ctx.ellipse(cx, 508, 108, 92, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff6f0'
  ctx.beginPath()
  ctx.ellipse(cx, 518, 58, 48, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f4b8a8'
  ctx.beginPath()
  ctx.ellipse(cx - 42, 598, 28, 16, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + 42, 598, 28, 16, 0, 0, Math.PI * 2)
  ctx.fill()

  const halo = ctx.createRadialGradient(cx, headY, 40, cx, headY, headR + 18)
  halo.addColorStop(0, '#fff7ee')
  halo.addColorStop(1, '#f3e4d6')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, headY, headR + 10, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, headY, headR - 6, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(portrait, cx - headR + 6, headY - headR + 6, (headR - 6) * 2, (headR - 6) * 2)
  ctx.restore()

  ctx.strokeStyle = '#fffdf8'
  ctx.lineWidth = 18
  ctx.beginPath()
  ctx.arc(cx, headY, headR - 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(244, 184, 168, 0.55)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(cx, headY, headR - 14, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.arc(cx - 78, headY - 86, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + 92, headY - 48, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('生成失败'))
      else resolve(blob)
    }, 'image/png')
  })
}

export async function saveGeneratedPet(blob: Blob) {
  await putResourceFile(PET_AVATAR_FILE_ID, blob, 'q-pet.png')
  window.dispatchEvent(new Event(PET_AVATAR_EVENT))
}
