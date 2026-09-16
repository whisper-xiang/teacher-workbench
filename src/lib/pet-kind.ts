import type { PetKind, TeacherProfile } from '../data/types'

export const PET_PRESET_VERSION = 2

export const PET_PRESETS: { id: Exclude<PetKind, 'photo'>; label: string; hint: string }[] = [
  { id: 'live2d-cat', label: '黑猫 Hijiki', hint: 'Live2D' },
  { id: 'live2d-white-cat', label: '白猫 Tororo', hint: 'Live2D' },
  { id: 'ning', label: '小宁', hint: '默认伙伴' },
  { id: 'hamster', label: '仓鼠', hint: '圆滚滚' },
  { id: 'puppy', label: '狗狗', hint: '摇尾巴' },
  { id: 'kitty', label: '猫咪', hint: '软乎乎' },
  { id: 'bunny', label: '兔子', hint: '长耳朵' },
  { id: 'chick', label: '小鸡', hint: '黄茸茸' },
  { id: 'fox', label: '小狐', hint: '橙乎乎' },
]

export function resolvePetKind(profile: Pick<TeacherProfile, 'petKind' | 'petAvatarId'>): PetKind {
  if (profile.petKind) return profile.petKind
  if (profile.petAvatarId) return 'photo'
  return 'photo'
}

export function petDisplayName(kind: PetKind) {
  if (kind === 'photo') return '我的Q版'
  return PET_PRESETS.find((row) => row.id === kind)?.label ?? '黑猫 Hijiki'
}
