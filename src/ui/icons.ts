// AP-SQL Assistant — inline SVG icon set (stroke style, no external font/network dependency).

type IconName =
  | 'menu' | 'database' | 'table' | 'filter' | 'code' | 'bug' | 'sun' | 'moon'
  | 'monitor' | 'info' | 'download' | 'upload' | 'lock' | 'shield' | 'plus'
  | 'trash' | 'copy' | 'play' | 'wand' | 'compass' | 'check' | 'x' | 'chevron-right'
  | 'chevron-left' | 'search' | 'link' | 'save' | 'alert-triangle' | 'logo';

const PATHS: Record<IconName, string> = {
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="20"/>',
  filter: '<polygon points="4,4 20,4 14,12 14,18 10,20 10,12"/>',
  code: '<polyline points="8,6 2,12 8,18"/><polyline points="16,6 22,12 16,18"/>',
  bug: '<circle cx="12" cy="14" r="6"/><path d="M12 8V5"/><path d="M8 5l1.5 2"/><path d="M16 5l-1.5 2"/><path d="M6 14H3"/><path d="M21 14h-3"/><path d="M6.5 19 4 21"/><path d="M17.5 19 20 21"/><path d="M6.5 9.5 4 8"/><path d="M17.5 9.5 20 8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 3v12"/><polyline points="7,10 12,15 17,10"/><path d="M5 19h14"/>',
  upload: '<path d="M12 21V9"/><polyline points="7,14 12,9 17,14"/><path d="M5 5h14"/>',
  lock: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  trash: '<polyline points="4,7 20,7"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 7V4h6v3"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  play: '<polygon points="6,4 20,12 6,20"/>',
  wand: '<path d="M4 20 L16 8"/><path d="M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M18 12l.7 1.3 1.3.7-1.3.7-.7 1.3-.7-1.3-1.3-.7 1.3-.7z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><polygon points="15,9 13,13 9,15 11,11"/>',
  check: '<polyline points="4,12 9,17 20,6"/>',
  x: '<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>',
  'chevron-right': '<polyline points="9,5 16,12 9,19"/>',
  'chevron-left': '<polyline points="15,5 8,12 15,19"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h8V4"/><path d="M8 14h8v6H8z"/>',
  'alert-triangle': '<path d="M12 4 22 20H2z"/><line x1="12" y1="10" x2="12" y2="15"/><circle cx="12" cy="18" r="0.6" fill="currentColor" stroke="none"/>',
  logo: '<rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" opacity="0.12" stroke="none"/><ellipse cx="12" cy="7.5" rx="6" ry="2.2"/><path d="M6 7.5v5c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2v-5"/><path d="M6 12.5v4c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2v-4"/>'
};

export function icon(name: IconName, size = 18, extraClass = ''): string {
  return `<svg class="icon-badge-svg ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}

export function iconBadge(name: IconName, size = 18): string {
  return `<span class="icon-badge">${icon(name, size)}</span>`;
}
