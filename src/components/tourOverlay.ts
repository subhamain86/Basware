import type { WalkthroughStep, Route } from '../types';
import { store } from '../state/store';

// ============================================================================
// GuidedTour — V13.1 walkthrough. Explains the new Hamburger Menu, Settings,
// and Manual Schema Editor alongside all the pre-existing V11.9/V11.8.1
// content. Every step is DOM-anchored (targetSelector must exist on the
// page for that step); the engine opens the hamburger menu itself before
// pointing at nav items, and closes it again before moving to page content.
// ============================================================================

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  { id: 'w1', route: 'quickstart', targetSelector: '[data-tour="brand"]', title: 'Welcome to AP-SQL Assistant V13.1', body: 'This tool writes read-only and Change Request SQL for you, using your organization\'s active schema as the single source of truth.' },
  { id: 'w2', route: 'quickstart', targetSelector: '[data-tour="hamburger-btn"]', title: 'Hamburger Menu', body: 'All navigation now lives behind this single button — Quick Start, Query Builder, Schema, Error Rectifier, Settings, and About. Select it to open the menu.' },
  { id: 'w3', route: 'quickstart', targetSelector: '[data-tour="active-schema-badge"]', title: 'Active Schema indicator', body: 'This badge always shows which schema is currently active. All SQL generation is grounded against this schema only.' },
  { id: 'w4', route: 'readonly', targetSelector: '[data-tour="describe-card"]', title: 'Describe What You Need', body: 'Type a plain-language requirement here and select Build Query to generate SQL automatically.' },
  { id: 'w5', route: 'readonly', targetSelector: '[data-tour="generated-sql-card"]', title: 'Generated SQL', body: 'Your SQL appears here in real time. Copy, Validate, Regenerate and Optimize are all live.' },
  { id: 'w6', route: 'readonly', targetSelector: '[data-tour="tab-tables-columns"]', title: 'Tables & Columns', body: 'Use Select Tables to manually pick schema tables, Select Columns to choose fields, and Filters to build WHERE conditions.' },
  { id: 'w7', route: 'readonly', targetSelector: '[data-tour="tab-advanced"]', title: 'Advanced Options', body: 'Sorting, grouping, aggregation, joins, limits, DISTINCT and CASE/DECODE all live here.' },
  { id: 'w8', route: 'readonly', targetSelector: '[data-tour="tab-summary"]', title: 'Selected / Described Requirements', body: 'A live, always-up-to-date summary of everything you have selected or described so far.' },
  { id: 'w9', route: 'cr', targetSelector: '[data-tour="cr-query-type"]', title: 'Query Builder for CR', body: 'Build INSERT / UPDATE / DELETE statements here, independent from the Read Only builder, with mandatory-WHERE safeguards.' },
  { id: 'w10', route: 'schema-used', targetSelector: '[data-tour="schema-list"]', title: 'Used Schema', body: 'Switch between multiple stored schemas, sync, import, export, or set the default/active schema here.' },
  { id: 'w11', route: 'schema-editor', targetSelector: '[data-tour="schema-editor-select"]', title: 'Manual Schema Editor — Step 1: Select Schema', body: 'Choose which stored schema you want to edit. The editor always clearly shows which schema is currently being edited.' },
  { id: 'w12', route: 'schema-editor', targetSelector: '[data-tour="schema-editor-search"]', title: 'Search schema', body: 'Search across table name, column name, description, module, and alias — results update instantly without freezing the browser.' },
  { id: 'w13', route: 'schema-editor', targetSelector: '[data-tour="schema-editor-table"]', title: 'Scrollable schema table', body: 'Every column across every table is listed here as one row. Select a row to edit it, or use Add New Row to create one.' },
  { id: 'w14', route: 'schema-editor', targetSelector: '[data-tour="schema-editor-add"]', title: 'Add New Row', body: 'Opens a form to create a brand-new table+column entry. Required fields are validated before saving.' },
  { id: 'w15', route: 'schema-editor', targetSelector: '[data-tour="schema-editor-actions"]', title: 'Edit / Delete', body: 'Edit opens the same form pre-filled with the row\'s current values. Delete requires three separate confirmations, the last of which requires your operational password.' },
  { id: 'w16', route: 'error-rectifier', targetSelector: '[data-tour="error-rectifier-form"]', title: 'Error Rectifier', body: 'Paste a database error and the SQL that caused it to get an explanation and a suggested correction — always grounded in the current active schema.' },
  { id: 'w17', route: 'settings', targetSelector: '[data-tour="settings-security"]', title: 'Settings — Security', body: 'Change or reset the operational password here. This is the same password used everywhere else in the app, including Manual Schema Editor deletions.' },
  { id: 'w18', route: 'settings', targetSelector: '[data-tour="settings-danger"]', title: 'Settings — Danger Zone', body: 'Destructive, schema-wide operations live here, with an automatic backup download before anything is deleted.' },
  { id: 'w19', route: 'about', targetSelector: '[data-tour="about-panel"]', title: 'About', body: 'Version history, architecture, and safety notes for AP-SQL Assistant.' }
];

export class GuidedTour {
  private index = 0;
  private overlay?: HTMLDivElement;
  private navigate: (r: Route) => void;
  private steps: WalkthroughStep[];

  constructor(navigate: (r: Route) => void, steps: WalkthroughStep[] = WALKTHROUGH_STEPS) { this.navigate = navigate; this.steps = steps; }
  start(): void { this.index = 0; this.showStep(); }
  private cleanup(): void { this.overlay?.remove(); this.overlay = undefined; }
  exit(): void { this.cleanup(); store.markWalkthroughSeen(); }

  private showStep(): void {
    const step = this.steps[this.index];
    if (!step) { this.exit(); return; }
    if (store.route !== step.route) this.navigate(step.route);

    // If this step targets something inside the hamburger panel, open it first.
    const needsMenuOpen = step.targetSelector.includes('hamburger') || step.id === 'w2';
    if (needsMenuOpen) {
      const toggler = document.querySelector<HTMLButtonElement>('#navToggle');
      if (toggler && toggler.getAttribute('aria-expanded') !== 'true') toggler.click();
    }

    requestAnimationFrame(() => requestAnimationFrame(() => this.render(step)));
  }

  private render(step: WalkthroughStep): void {
    this.cleanup();
    const target = document.querySelector<HTMLElement>(step.targetSelector);
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    const rect = target?.getBoundingClientRect();
    const spotlightStyle = rect ? `top:${Math.max(4, rect.top - 6)}px;left:${Math.max(4, rect.left - 6)}px;width:${rect.width + 12}px;height:${rect.height + 12}px;` : 'display:none;';
    let popupTop = rect ? rect.bottom + 16 : window.innerHeight / 2 - 100;
    const popupWidth = Math.min(420, window.innerWidth - 32);
    let popupLeft = rect ? Math.min(Math.max(16, rect.left), window.innerWidth - popupWidth - 16) : (window.innerWidth - popupWidth) / 2;
    if (popupTop + 220 > window.innerHeight) popupTop = Math.max(16, (rect?.top || window.innerHeight / 2) - 236);
    const dots = this.steps.map((_, i) => `<span class="tour-dot ${i === this.index ? 'active' : ''}"></span>`).join('');
    overlay.innerHTML = `
      <div class="tour-spotlight" style="${spotlightStyle}"></div>
      <div class="tour-popup" style="top:${popupTop}px; left:${popupLeft}px; width:${popupWidth}px;">
        <div class="tour-step-label">Step ${this.index + 1} of ${this.steps.length}</div>
        <h4>${step.title}</h4><p>${step.body}</p>
        <div class="tour-dots">${dots}</div>
        <div class="tour-actions">
          <button id="tourExit" class="btn btn-ghost" type="button">Exit</button>
          <button id="tourSkip" class="btn btn-ghost" type="button">Skip</button>
          <div class="tour-actions-right">
            <button id="tourPrev" class="btn btn-ghost" type="button" ${this.index === 0 ? 'disabled' : ''}>Back</button>
            <button id="tourNext" class="btn btn-primary" type="button">${this.index === this.steps.length - 1 ? 'Finish' : 'Next'}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay); this.overlay = overlay;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    overlay.querySelector('#tourExit')?.addEventListener('click', () => this.exit());
    overlay.querySelector('#tourSkip')?.addEventListener('click', () => this.exit());
    overlay.querySelector('#tourPrev')?.addEventListener('click', () => { this.index = Math.max(0, this.index - 1); this.showStep(); });
    overlay.querySelector('#tourNext')?.addEventListener('click', () => { if (this.index === this.steps.length - 1) { this.exit(); return; } this.index += 1; this.showStep(); });
  }
}
