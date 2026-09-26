import { icon } from './icons';
import { store } from '../state/store';
import { schemaService } from '../services/schemaService';
import type { Route, Theme } from '../types';

// ============================================================================
// hamburgerNav — V13.1's primary navigation container. Replaces the old
// always-visible top navbar links: the hamburger button is now the ONLY way
// to open navigation at every breakpoint (desktop and mobile), per spec
// section 4 ("The Hamburger Menu should become the primary navigation
// container for the application"). Supports two-level nesting (Query
// Builder -> Read Only / CR, Schema -> Used Schema / Manual Schema Editor),
// closes on outside-click, closes on Escape, and never overflows the
// viewport horizontally at any width from 375px to 1920px.
// ============================================================================

interface NavLeaf { id: Route; label: string; icon: Parameters<typeof icon>[0]; tourSelector?: string; }
interface NavGroup { id: string; label: string; icon: Parameters<typeof icon>[0]; children: NavLeaf[]; tourSelector?: string; }

const NAV_STRUCTURE: (NavLeaf | NavGroup)[] = [
  { id: 'quickstart', label: 'Quick Start', icon: 'compass' },
  { id: 'query-builder-group', label: 'Query Builder', icon: 'code', tourSelector: 'nav-query-builder', children: [
    { id: 'readonly', label: 'Read Only Query Builder', icon: 'table', tourSelector: 'nav-readonly' },
    { id: 'cr', label: 'Query Builder for CR', icon: 'edit', tourSelector: 'nav-cr' }
  ]},
  { id: 'schema-group', label: 'Schema', icon: 'database', tourSelector: 'nav-schema', children: [
    { id: 'schema-used', label: 'Used Schema', icon: 'layout-grid', tourSelector: 'nav-schema-used' },
    { id: 'schema-editor', label: 'Manual Schema Editor', icon: 'grid', tourSelector: 'nav-schema-editor' }
  ]},
  { id: 'error-rectifier', label: 'Error Rectifier', icon: 'bug', tourSelector: 'nav-error' },
  { id: 'settings', label: 'Settings', icon: 'settings', tourSelector: 'nav-settings' },
  { id: 'about', label: 'About', icon: 'info' }
];

function isGroup(entry: NavLeaf | NavGroup): entry is NavGroup { return 'children' in entry; }

export function renderNavbar(container: HTMLElement, onNavigate: (r: Route) => void, onStartTour: () => void): void {
  let menuOpen = false;
  let expandedGroup: string | null = null;

  function activeRoute(): Route { return store.route; }

  function routeIsInGroup(group: NavGroup): boolean { return group.children.some((c) => c.id === activeRoute()); }

  function draw(): void {
    const activeSchema = schemaService.getActiveSchema();

    container.innerHTML = `
      <nav class="navbar">
        <div class="container-fluid navbar-inner">
          <div class="hero-brand-row" data-tour="brand">
            <span class="app-logo-badge">${icon('logo', 24)}</span>
            <div class="brand-text"><span class="builder-heading">AP-SQL Assistant</span><span class="small">V13.1</span></div>
          </div>
          <div class="navbar-right-cluster">
            <span class="schema-badge" data-tour="active-schema-badge" title="Active schema">${icon('database', 14)} ${activeSchema.name}</span>
            <div class="theme-toggle-wrap" data-tour="theme-toggle">
              <button id="themeBtn" class="btn btn-ghost btn-sm icon-only" type="button" aria-haspopup="true" aria-expanded="false" title="Theme">${icon(themeIconName(), 18)}</button>
              <div id="themeMenu" class="theme-menu" hidden>
                <button data-theme-choice="system" type="button">${icon('monitor', 15)} System Default</button>
                <button data-theme-choice="light" type="button">${icon('sun', 15)} Light</button>
                <button data-theme-choice="dark" type="button">${icon('moon', 15)} Dark</button>
              </div>
            </div>
            <button class="navbar-toggler" id="navToggle" type="button" aria-label="Toggle navigation menu" aria-expanded="${menuOpen}" data-tour="hamburger-btn">${icon('menu', 22)}</button>
          </div>
        </div>
      </nav>
      <div class="hamburger-overlay ${menuOpen ? 'open' : ''}" id="hamburgerOverlay" ${menuOpen ? '' : 'hidden'}>
        <div class="hamburger-panel" role="dialog" aria-modal="true" aria-label="Navigation menu" data-tour="hamburger-panel">
          <div class="hamburger-panel-header">
            <span class="hamburger-panel-title">${icon('menu', 18)} Navigation</span>
            <button type="button" class="icon-btn" id="hamburgerCloseBtn" aria-label="Close menu">${icon('x', 18)}</button>
          </div>
          <div class="hamburger-panel-body">
            ${NAV_STRUCTURE.map((entry) => {
              if (isGroup(entry)) {
                const inGroup = routeIsInGroup(entry);
                const isExpanded = expandedGroup === entry.id || inGroup;
                return `
                  <div class="hb-group">
                    <button type="button" class="hb-group-toggle ${inGroup ? 'active' : ''}" data-group="${entry.id}" ${entry.tourSelector ? `data-tour="${entry.tourSelector}"` : ''} aria-expanded="${isExpanded}">
                      ${icon(entry.icon, 18)}<span>${entry.label}</span>${icon('chevron-down', 15, isExpanded ? 'rotated' : '')}
                    </button>
                    <div class="hb-group-children" ${isExpanded ? '' : 'hidden'}>
                      ${entry.children.map((c) => `<a href="#${c.id}" data-route="${c.id}" ${c.tourSelector ? `data-tour="${c.tourSelector}"` : ''} class="hb-link hb-link-child ${activeRoute() === c.id ? 'active' : ''}">${icon(c.icon, 16)}<span>${c.label}</span></a>`).join('')}
                    </div>
                  </div>`;
              }
              return `<a href="#${entry.id}" data-route="${entry.id}" ${entry.tourSelector ? `data-tour="${entry.tourSelector}"` : ''} class="hb-link ${activeRoute() === entry.id ? 'active' : ''}">${icon(entry.icon, 18)}<span>${entry.label}</span></a>`;
            }).join('')}
            <div class="hb-divider"></div>
            <button type="button" class="hb-link hb-tour-btn" id="tourBtnHb">${icon('play', 18)}<span>Guided Walkthrough</span></button>
          </div>
        </div>
      </div>`;

    wireEvents();
  }

  function themeIconName(): Parameters<typeof icon>[0] { return store.theme === 'light' ? 'sun' : store.theme === 'dark' ? 'moon' : 'monitor'; }

  function closeMenu(): void { menuOpen = false; expandedGroup = null; draw(); }
  function openMenu(): void { menuOpen = true; draw(); }

  function wireEvents(): void {
    const toggler = container.querySelector<HTMLButtonElement>('#navToggle');
    toggler?.addEventListener('click', () => { menuOpen ? closeMenu() : openMenu(); });

    container.querySelector('#hamburgerCloseBtn')?.addEventListener('click', closeMenu);
    container.querySelector('#hamburgerOverlay')?.addEventListener('click', (e) => { if (e.target === container.querySelector('#hamburgerOverlay')) closeMenu(); });

    if (menuOpen) {
      const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') { closeMenu(); document.removeEventListener('keydown', escHandler); } };
      document.addEventListener('keydown', escHandler);
    }

    container.querySelectorAll<HTMLButtonElement>('.hb-group-toggle').forEach((btn) => {
      btn.addEventListener('click', () => { const gid = btn.dataset.group!; expandedGroup = expandedGroup === gid ? null : gid; draw(); });
    });

    container.querySelectorAll<HTMLAnchorElement>('[data-route]').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); onNavigate(a.dataset.route as Route); closeMenu(); });
    });

    container.querySelector('#tourBtnHb')?.addEventListener('click', () => { closeMenu(); onStartTour(); });

    const themeBtn = container.querySelector<HTMLButtonElement>('#themeBtn');
    const themeMenu = container.querySelector<HTMLDivElement>('#themeMenu');
    themeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = themeMenu?.hasAttribute('hidden');
      if (isHidden) themeMenu?.removeAttribute('hidden'); else themeMenu?.setAttribute('hidden', '');
      themeBtn.setAttribute('aria-expanded', String(!!isHidden));
    });
    document.addEventListener('click', () => themeMenu?.setAttribute('hidden', ''));
    container.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); store.setTheme(btn.dataset.themeChoice as Theme); themeMenu?.setAttribute('hidden', ''); });
    });
  }

  store.subscribe(draw);
  schemaService.subscribe(draw);
  draw();
}
