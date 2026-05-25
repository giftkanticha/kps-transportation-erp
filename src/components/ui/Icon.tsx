import React from 'react'

export interface IconProps {
  name: string
  size?: number
  color?: string
  style?: React.CSSProperties
  className?: string
}

export function Icon({ name, size = 18, color = 'currentColor', style, className }: IconProps): React.ReactElement {
  const s = size
  const props = {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style,
    className,
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      )
    case 'truck':
      return (
        <svg {...props}>
          <path d="M3 7h11v10H3z" />
          <path d="M14 10h4l3 3v4h-7" />
          <circle cx="6.5" cy="17.5" r="1.7" />
          <circle cx="17.5" cy="17.5" r="1.7" />
        </svg>
      )
    case 'user':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      )
    case 'users':
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
          <circle cx="17" cy="9" r="2.8" />
          <path d="M22 19c0-2.5-2.1-4-5-4" />
        </svg>
      )
    case 'trip':
      return (
        <svg {...props}>
          <path d="M5 19V5h6l8 14H5z" fill="none" />
          <circle cx="8" cy="8" r="1.3" fill={color} stroke="none" />
          <circle cx="16" cy="16" r="1.3" fill={color} stroke="none" />
          <path d="M8 8C8 13 13 16 16 16" />
        </svg>
      )
    case 'client':
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="14" rx="1.5" />
          <path d="M8 6V4h8v2" />
          <path d="M3 12h18" />
        </svg>
      )
    case 'wrench':
      return (
        <svg {...props}>
          <path d="M14.7 6.3a4 4 0 1 0 4.6 6.4l-5 5L7 11l4-4 1 1 2.7-1.7z" />
        </svg>
      )
    case 'tire':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2" />
        </svg>
      )
    case 'wheel':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9.5" strokeWidth="2.4" />
          <circle cx="12" cy="12" r="5.4" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
          <g fill={color} stroke="none">
            <circle cx="12" cy="8.7" r="0.85" />
            <circle cx="14.86" cy="10.35" r="0.85" />
            <circle cx="14.86" cy="13.65" r="0.85" />
            <circle cx="12" cy="15.3" r="0.85" />
            <circle cx="9.14" cy="13.65" r="0.85" />
            <circle cx="9.14" cy="10.35" r="0.85" />
          </g>
        </svg>
      )
    case 'history':
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
          <path d="M3 4v4h4" />
          <path d="M12 8v4l3 1.5" />
        </svg>
      )
    case 'list':
      return (
        <svg {...props}>
          <path d="M9 7h11M9 12h11M9 17h11" />
          <circle cx="4.5" cy="7" r="1" fill={color} stroke="none" />
          <circle cx="4.5" cy="12" r="1" fill={color} stroke="none" />
          <circle cx="4.5" cy="17" r="1" fill={color} stroke="none" />
        </svg>
      )
    case 'bolt':
      return (
        <svg {...props}>
          <path d="M13 2 5 13h6l-1 9 9-12h-6z" />
        </svg>
      )
    case 'building':
      return (
        <svg {...props}>
          <rect x="5" y="3" width="14" height="18" rx="1" />
          <path d="M9 7h1.5M13.5 7h1.5M9 11h1.5M13.5 11h1.5M9 15h1.5M13.5 15h1.5" />
          <path d="M5 21h14" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 0 1 15.5-6.3" />
          <path d="M19 2.5v4h-4" />
          <path d="M21 12a9 9 0 0 1-15.5 6.3" />
          <path d="M5 21.5v-4h4" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...props}>
          <path d="M3 21V5" />
          <path d="M21 21H3" />
          <rect x="7" y="13" width="3" height="6" />
          <rect x="12" y="9" width="3" height="10" />
          <rect x="17" y="5" width="3" height="14" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4.8a7 7 0 0 0-2-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.4-.8-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-.8a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.4.8 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" />
        </svg>
      )
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...props}>
          <path d="M18 16H6l1.5-2V11a4.5 4.5 0 0 1 9 0v3l1.5 2z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'filter':
      return (
        <svg {...props}>
          <path d="M3 5h18l-7 9v6l-4-2v-4z" />
        </svg>
      )
    case 'download':
      return (
        <svg {...props}>
          <path d="M12 3v12m0 0-4-4m4 4 4-4" />
          <path d="M5 21h14" />
        </svg>
      )
    case 'chevron-right':
      return (
        <svg {...props}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      )
    case 'chevron-down':
      return (
        <svg {...props}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      )
    case 'arrow-up':
      return (
        <svg {...props}>
          <path d="M12 19V5m0 0-5 5m5-5 5 5" />
        </svg>
      )
    case 'arrow-down':
      return (
        <svg {...props}>
          <path d="M12 5v14m0 0-5-5m5 5 5-5" />
        </svg>
      )
    case 'arrow-right':
      return (
        <svg {...props}>
          <path d="M5 12h14m0 0-5-5m5 5-5 5" />
        </svg>
      )
    case 'close':
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'edit':
      return (
        <svg {...props}>
          <path d="M4 20h4l11-11-4-4L4 16z" />
          <path d="M14 5l4 4" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...props}>
          <path d="M4 7h16M9 7V4h6v3M6 7v13h12V7" />
        </svg>
      )
    case 'more':
      return (
        <svg {...props}>
          <circle cx="5" cy="12" r="1.3" fill={color} />
          <circle cx="12" cy="12" r="1.3" fill={color} />
          <circle cx="19" cy="12" r="1.3" fill={color} />
        </svg>
      )
    case 'check':
      return (
        <svg {...props}>
          <path d="m5 12 5 5 9-11" />
        </svg>
      )
    case 'alert':
      return (
        <svg {...props}>
          <path d="M12 3 2 21h20z" />
          <path d="M12 10v5" />
          <circle cx="12" cy="18" r=".5" fill={color} />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="1.5" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...props}>
          <path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...props}>
          <path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <path d="m3 7 9 7 9-7" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...props}>
          <path d="M15 4h4v16h-4" />
          <path d="M10 8l-4 4 4 4" />
          <path d="M6 12h12" />
        </svg>
      )
    case 'fuel':
      return (
        <svg {...props}>
          <rect x="4" y="3" width="10" height="18" rx="1" />
          <path d="M14 7h2l2 2v8a2 2 0 0 1-4 0v-3" />
          <path d="M7 7h4" />
        </svg>
      )
    case 'gauge':
      return (
        <svg {...props}>
          <path d="M3 16a9 9 0 1 1 18 0" />
          <path d="m12 16 4-6" />
          <circle cx="12" cy="16" r="1.2" fill={color} />
        </svg>
      )
    case 'package':
      return (
        <svg {...props}>
          <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
          <path d="M3 7l9 4 9-4M12 21V11" />
        </svg>
      )
    case 'money':
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="12" rx="1.5" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 9v6M18 9v6" />
        </svg>
      )
    case 'circle':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" fill={color} />
        </svg>
      )
    case 'globe':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      )
    case 'truck2':
      return (
        <svg {...props}>
          <path d="M2 8h10v9H2z" />
          <path d="M12 11h5l4 4v2h-9" />
          <circle cx="5.5" cy="18" r="1.7" />
          <circle cx="17.5" cy="18" r="1.7" />
        </svg>
      )
    case 'wallet':
      return (
        <svg {...props}>
          <path d="M3 7c0-1 .8-2 2-2h12v4H5" />
          <path d="M3 7v11c0 1 .8 2 2 2h14a2 2 0 0 0 2-2v-9H5c-1 0-2-.8-2-2z" />
          <circle cx="17" cy="14" r="1.3" fill={color} />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" />
        </svg>
      )
  }
}
