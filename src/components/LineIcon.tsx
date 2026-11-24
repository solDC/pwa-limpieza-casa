const paths = {
  settings: 'M10 2h4l.7 3 2 .9 2.7-1.2 2 3.5-2.2 2v2.6l2.2 2-2 3.5-2.7-1.2-2 .9-.7 3h-4l-.7-3-2-.9-2.7 1.2-2-3.5 2.2-2v-2.6l-2.2-2 2-3.5 2.7 1.2 2-.9L10 2Z M15 12a3 3 0 1 0-6 0 3 3 0 1 0 6 0',
  logout: 'M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5m4-12 4 4-4 4m-6-4h12',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm6 5v2',
  mail: 'M12 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6M2 7l10 6L22 7m-8 11 3 3 5-5',
  more: 'M5.8 12a.8.8 0 1 0-1.6 0 .8.8 0 1 0 1.6 0Zm7 0a.8.8 0 1 0-1.6 0 .8.8 0 1 0 1.6 0Zm7 0a.8.8 0 1 0-1.6 0 .8.8 0 1 0 1.6 0Z',
  circle: 'M22 12a10 10 0 1 0-20 0 10 10 0 1 0 20 0Z',
  chevron: 'm6 9 6 6 6-6',
  check: 'm5 12 4 4L19 6',
  partial: 'M22 12a10 10 0 1 0-20 0 10 10 0 1 0 20 0Zm-10-6v6l4 2',
  cross: 'm6 6 12 12M18 6 6 18',
  calendar: 'M6 3v4m12-4v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  pencil: 'm4 16 12-12a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3L8 20l-5 1 1-5ZM14 6l4 4',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.1M4 12h.1M4 18h.1',
  plus: 'M12 5v14M5 12h14',
}

export function LineIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg className="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  )
}
