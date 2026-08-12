import type { ReactNode } from 'react'

const icon = (glyph: string, label: string) => function Icon(): ReactNode {
  return <span className="app-icon" aria-hidden="true" title={label}>{glyph}</span>
}

export const AddRegular = icon('＋', '添加')
export const ArrowUpRightRegular = icon('↗', '打开')
export const BookmarkRegular = icon('⌑', '收藏')
export const CalendarEditRegular = icon('▦', '编辑日历')
export const CheckmarkRegular = icon('✓', '完成')
export const DismissRegular = icon('×', '关闭')
export const EditRegular = icon('✎', '编辑')
export const FilterRegular = icon('≡', '筛选')
export const FolderRegular = icon('▱', '文件夹')
export const LocationRegular = icon('⌖', '地点')
export const PeopleRegular = icon('♙', '学生')
export const SearchRegular = icon('⌕', '搜索')
export const SettingsRegular = icon('⚙', '设置')
export const StarFilled = icon('★', '已收藏')
export const StarRegular = icon('☆', '收藏')
