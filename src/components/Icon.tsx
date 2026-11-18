import type { SVGProps } from 'react';

export type IconName =
  | 'hat'
  | 'scan'
  | 'link'
  | 'globe'
  | 'lock'
  | 'route'
  | 'file'
  | 'badge'
  | 'shield'
  | 'terminal'
  | 'download'
  | 'copy'
  | 'check'
  | 'alert'
  | 'x'
  | 'chevron-down'
  | 'chevron-right'
  | 'arrow-right'
  | 'sparkles'
  | 'menu'
  | 'help'
  | 'play'
  | 'history'
  | 'book'
  | 'trash'
  | 'refresh'
  | 'external'
  | 'clipboard'
  | 'eye'
  | 'flag'
  | 'database'
  | 'code'
  | 'info';

const PATHS: Record<IconName, React.ReactNode> = {
  hat: (
    <>
      <path d="M4 16.5h16l-2.2-3H6.2L4 16.5Z" />
      <path d="M7 13.5V8.2a5 5 0 0 1 10 0v5.3" />
      <path d="M8.5 8.2h7" />
    </>
  ),
  scan: (
    <>
      <circle cx="11" cy="11" r="6.2" />
      <path d="m15.6 15.6 4.6 4.6M8.8 11h4.4M11 8.8v4.4" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.8a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.3 6.8" />
      <path d="M14 10.2a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.3-1.3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5S14.4 18.2 12 20.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5Z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="3" />
      <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5M12 14.5v2.5" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M8.2 18h4.3a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h5.8" />
    </>
  ),
  file: (
    <>
      <path d="M6.5 3.5h7l4.5 4.5v12.5h-11.5V3.5Z" />
      <path d="M13.5 3.5V8h4.5M9 12h6M9 15.5h6" />
    </>
  ),
  badge: (
    <>
      <path d="M12 3.5 19 6v5.4c0 4.2-2.8 7.4-7 9.1-4.2-1.7-7-4.9-7-9.1V6l7-2.5Z" />
      <path d="m9 12 2.1 2.1L15.4 10" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.4c0 4.2-2.8 7.4-7 9.1-4.2-1.7-7-4.9-7-9.1V6l7-2.5Z" />
      <path d="M12 8v4M12 15.5v.1" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <path d="m7.5 10 2.6 2.4-2.6 2.4M12.5 15h4" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v10M8 10.5l4 3.5 4-3.5" />
      <path d="M4.5 17.5v1a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 8.5v-2A2.5 2.5 0 0 0 13 4h-7a2 2 0 0 0-2 2v8a2.5 2.5 0 0 0 2.5 2.5h2" />
    </>
  ),
  check: <path d="m5 12.5 4.4 4.4L19 7.5" />,
  alert: (
    <>
      <path d="M12 4 21 20H3L12 4Z" />
      <path d="M12 9.5v4.5M12 17.5v.1" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
  'chevron-down': <path d="m6.5 9.5 5.5 5 5.5-5" />,
  'chevron-right': <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />,
  'arrow-right': <path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" />,
  sparkles: (
    <>
      <path d="M12 4.5 13.4 9l4.5 1.4-4.5 1.4L12 16.3l-1.4-4.5L6.1 10.4 10.6 9 12 4.5Z" />
      <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </>
  ),
  menu: <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />,
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.3 1-1.3 2.1M12 17.2v.1" />
    </>
  ),
  play: <path d="M9 6.8v10.4l8-5.2-8-5.2Z" />,
  history: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
      <path d="M4.5 4.5V9H9M12 8v4.5l3 1.8" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5h9a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3V4.5Z" />
      <path d="M5 16.5a3 3 0 0 1 3-3h9M8 8h5" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9 7V5h6v2M6.5 7l.8 12.5h9.4L17.5 7" />
      <path d="M10 10.5v5.5M14 10.5v5.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 11a7.5 7.5 0 1 0-1.7 6.4" />
      <path d="M19.5 5.5V11H14" />
    </>
  ),
  external: (
    <>
      <path d="M13.5 4.5H19.5V10.5M19.5 4.5l-8 8" />
      <path d="M17 13.5v5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7h5" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="4.5" width="12" height="16" rx="2.5" />
      <path d="M9 4.5V3.8A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8v.7" />
      <path d="M9 10h6M9 13.5h6M9 17h4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4.5c4-1.6 8 1.6 12 0v9.5c-4 1.6-8-1.6-12 0" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
      <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </>
  ),
  code: <path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5M13.5 4.5l-3 15" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.8v.1" />
    </>
  ),
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
