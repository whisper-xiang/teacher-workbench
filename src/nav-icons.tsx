type IconName =
  | 'overview'
  | 'calendar'
  | 'tasks'
  | 'reminders'
  | 'courses'
  | 'students'
  | 'resources'
  | 'news'
  | 'tools'
  | 'settings'
  | 'collapse'
  | 'expand'
  | 'search'
  | 'plus'
  | 'bell'
  | 'pin'
  | 'wind'
  | 'drop'
  | 'eye'

const svg = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function NavIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  const props = { ...svg, width: size, height: size }
  switch (name) {
    case 'overview':
      return (
        <svg {...props}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
          <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
        </svg>
      )
    case 'tasks':
      return (
        <svg {...props}>
          <path d="M4 6h10M4 12h16M4 18h12" />
          <path d="M16.5 5.5 18 7l3-3" />
        </svg>
      )
    case 'reminders':
    case 'bell':
      return (
        <svg {...props}>
          <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'courses':
      return (
        <svg {...props}>
          <path d="M4 6.5c2.4-1.4 4.6-1.4 8 0s5.6 1.4 8 0v11c-2.4 1.4-4.6 1.4-8 0s-5.6-1.4-8 0Z" />
          <path d="M12 6.5v11" />
        </svg>
      )
    case 'students':
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.8 19c.6-3 2.6-4.5 5.2-4.5S13.6 16 14.2 19" />
          <circle cx="16.5" cy="8.5" r="2.3" />
          <path d="M16 14.6c2.2.2 3.8 1.6 4.3 4.4" />
        </svg>
      )
    case 'resources':
      return (
        <svg {...props}>
          <path d="M3.5 8.5h17v10a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
          <path d="M3.5 8.5 5.8 4.8a1.6 1.6 0 0 1 1.4-.8h4.2c.5 0 1 .2 1.3.6L14 8.5" />
        </svg>
      )
    case 'news':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="2.2" />
          <path d="M8 9h8M8 12.5h8M8 16h5" />
        </svg>
      )
    case 'tools':
      return (
        <svg {...props}>
          <path d="M14.5 4.8a4.4 4.4 0 0 1 4.7 4.7L15.8 13l-4.8-4.8Z" />
          <path d="M11 8.2 4.6 14.6a2 2 0 0 0 0 2.8l2 2a2 2 0 0 0 2.8 0L15.8 13" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.6v2.2M12 18.2v2.2M4.8 7.2l1.9 1.1M17.3 15.7l1.9 1.1M4.8 16.8l1.9-1.1M17.3 8.3l1.9-1.1M3.6 12h2.2M18.2 12h2.2" />
        </svg>
      )
    case 'collapse':
      return (
        <svg {...props}>
          <path d="M14.5 6 9 12l5.5 6M8 6v12" />
        </svg>
      )
    case 'expand':
      return (
        <svg {...props}>
          <path d="M9.5 6 15 12l-5.5 6M16 6v12" />
        </svg>
      )
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.2" />
          <path d="m20 20-3.4-3.4" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...props}>
          <path d="M12 6v12M6 12h12" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...props}>
          <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.8 12 21 12 21Z" />
          <circle cx="12" cy="10.5" r="2.1" />
        </svg>
      )
    case 'wind':
      return (
        <svg {...props}>
          <path d="M3 9h11a2.4 2.4 0 1 0-2.4-2.4" />
          <path d="M3 13h14.5a2.6 2.6 0 1 1-2.6 2.6" />
        </svg>
      )
    case 'drop':
      return (
        <svg {...props}>
          <path d="M12 3.5c3.8 4.4 6 7.3 6 10.2a6 6 0 1 1-12 0C6 10.8 8.2 7.9 12 3.5Z" />
        </svg>
      )
    case 'eye':
      return (
        <svg {...props}>
          <path d="M2.8 12s3.4-6.2 9.2-6.2S21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12Z" />
          <circle cx="12" cy="12" r="2.4" />
        </svg>
      )
  }
}

export type { IconName }
