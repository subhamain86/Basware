import { icon } from './icons';
import { applyTheme, getStoredTheme } from './theme';
import type { Theme } from '../types';

export type Route = 'quickstart' | 'readonly' | 'cr' | 'schema-used' | 'schema-update' | 'error' | 'about';

export function renderNavbar(active: Route, onNavigate: (r: Route) => void, onStartTour: () => void): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'navbar';

  nav.innerHTML = `
    <div class="container-fluid">
      <button class="navbar-toggler" id="navToggle" type="button" aria-label="Toggle navigation">
        ${icon('menu', 22)}
      </button>
      <div class="hero-brand-row" data-tour="brand">
        <span class="app-logo-badge">${icon('logo', 26)}</span>
        <div class="brand-text">
          <span class="builder-heading">AP-SQL Assistant</span>
          <span class="small">Version 12.0 · TypeScript + Vite</span>
        </div>
      </div>

      <div class="navbar-collapse" id="navbarFitCollapse">
        <ul class="nav-links">
          <li><a href="#quickstart" data-route="quickstart" class="nav-link ${active === 'quickstart' ? 'active' : ''}">${icon('compass')}<span>Quick Start</span></a></li>
          <li><a href="#readonly" data-tour="nav-readonly" data-route="readonly" class="nav-link ${active === 'readonly' ? 'active' : ''}">${icon('table')}<span>Read Only Query Builder</span></a></li>
          <li><a href="#cr" data-tour="nav-cr" data-route="cr" class="nav-link ${active === 'cr' ? 'active' : ''}">${icon('code')}<span>Query Builder for CR</span></a></li>
          <li><a href="#schema-used" data-tour="nav-schema" data-route="schema-used" class="nav-link ${active === 'schema-used' || active === 'schema-update' ? 'active' : ''}">${icon('database')}<span>Schema</span></a></li>
          <li><a href="#error" data-tour="nav-error" data-route="error" class="nav-link ${active === 'error' ? 'active' : ''}">${icon('bug')}<span>Error Rectifier</span></a></li>
          <li><a href="#about" data-route="about" class="nav-link ${active === 'about' ? 'active' : ''}">${icon('info')}<span>About</span></a></li>
        </ul>

        <div class="sync-schedule-row">
          <button id="tourBtn" class="btn btn-outline btn-sm" type="button">${icon('play', 16)}<span class="sync-schedule-label-text">Guided Walkthrough</span></button>
          <div class="theme-toggle-wrap" data-tour="theme-toggle">
            <button id="themeBtn" class="btn btn-ghost btn-sm icon-only" type="button" aria-haspopup="true" aria-expanded="false" title="Theme">
              ${icon('monitor', 18)}
            </button>
            <div id="themeMenu" class="theme-menu" hidden>
              <button data-theme-choice="system" type="button">${icon('monitor', 15)} System Default</button>
              <button data-theme-choice="light" type="button">${icon('sun', 15)} Light</button>
              <button data-theme-choice="dark" type="button">${icon('moon', 15)} Dark</button>
            </div>
          </div>
          <span class="creator-signature-wrap small">Crafted by Subham Ain</span>
        </div>
      </div>
    </div>`;

  nav.querySelectorAll<HTMLAnchorElement>('[data-route]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      onNavigate(a.dataset.route as Route);
      nav.querySelector('.navbar-collapse')?.classList.remove('open');
    });
  });

  nav.querySelector('#navToggle')?.addEventListener('click', () => {
    nav.querySelector('.navbar-collapse')?.classList.toggle('open');
  });

  nav.querySelector('#tourBtn')?.addEventListener('click', onStartTour);

  const themeBtn = nav.querySelector<HTMLButtonElement>('#themeBtn');
  const themeMenu = nav.querySelector<HTMLDivElement>('#themeMenu');
  themeBtn?.addEventListener('click', () => {
    const isHidden = themeMenu?.hasAttribute('hidden');
    if (isHidden) themeMenu?.removeAttribute('hidden'); else themeMenu?.setAttribute('hidden', '');
    themeBtn.setAttribute('aria-expanded', String(!!isHidden));
  });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target as Node)) themeMenu?.setAttribute('hidden', '');
  });
  nav.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.themeChoice as Theme);
      themeMenu?.setAttribute('hidden', '');
      updateThemeIcon();
    });
  });

  function updateThemeIcon(): void {
    const t = getStoredTheme();
    const iconName = t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'monitor';
    if (themeBtn) themeBtn.innerHTML = icon(iconName, 18);
  }
  updateThemeIcon();

  return nav;
}
