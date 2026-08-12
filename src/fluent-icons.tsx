import type { CSSProperties } from 'react'

type IconProps = { className?: string; style?: CSSProperties; 'aria-label'?: string }

const symbol = (glyph: string) => ({ className, style, 'aria-label': label }: IconProps) => <span className={className} style={{ display: 'inline-grid', placeItems: 'center', width: '1em', height: '1em', lineHeight: 1, ...style }} aria-label={label} aria-hidden={label ? undefined : true}>{glyph}</span>

export const AddRegular = symbol('＋')
export const ArrowUpRightRegular = symbol('↗')
export const BookmarkRegular = symbol('♡')
export const BookOpenRegular = symbol('▤')
export const CalendarEditRegular = symbol('▣')
export const CheckmarkRegular = symbol('✓')
export const DismissRegular = symbol('×')
export const DocumentRegular = symbol('▤')
export const EditRegular = symbol('✎')
export const FilterRegular = symbol('≡')
export const FolderRegular = symbol('□')
export const LocationRegular = symbol('⌖')
export const PeopleRegular = symbol('♧')
export const SearchRegular = symbol('⌕')
export const SettingsRegular = symbol('⚙')
export const StarFilled = symbol('★')
export const StarRegular = symbol('☆')
