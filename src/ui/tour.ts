import type { TourStep } from '../types';

// tour-engine.ts — interactive, context-aware Guided Walkthrough engine.

export const QUICKSTART_TOUR: TourStep[] = [
  { targetSelector: '[data-tour="brand"]', title: 'Welcome to AP-SQL Assistant', body: 'This tool writes read-only and Change Request SQL for you, using your organization\'s approved schema as the single source of truth.' },
  { targetSelector: '[data-tour="nav-readonly"]', title: 'Read Only Query Builder', body: 'Describe what you need in plain language, or make manual selections, to build validated SELECT / WITH statements.' },
  { targetSelector: '[data-tour="nav-cr"]', title: 'Query Builder for CR', body: 'Build INSERT / UPDATE / DELETE SQL text for Change Requests. Mutating statements require a WHERE condition, with an explicit override if you really need none.' },
  { targetSelector: '[data-tour="nav-schema"]', title: 'Schema', body: 'Browse the active schema, or use an administrator password to update it — including a Smart Schema Import Engine for JSON/CSV.' },
  { targetSelector: '[data-tour="nav-error"]', title: 'Error Rectifier', body: 'Paste a database error and the SQL that caused it to get a corrected query and a plain-language explanation.' },
  { targetSelector: '[data-tour="theme-toggle"]', title: 'Theme', body: 'Switch between System, Light and Dark — your choice is remembered on this device.' }
];

export class GuidedTour {
  private steps: TourStep[];
  private index = 0;
  private overlay?: HTMLDivElement;

  constructor(steps: TourStep[]) {
    this.steps = steps;
  }

  start(): void {
    this.index = 0;
    this.render();
  }

  private cleanup(): void {
    this.overlay?.remove();
    this.overlay = undefined;
  }

  private render(): void {
    this.cleanup();
    const step = this.steps[this.index];
    if (!step) return;
    const target = document.querySelector<HTMLElement>(step.targetSelector);

    const overlay = document.createElement('div');
    overlay.id = 'tourOverlay';
    overlay.className = 'tour-overlay';

    const rect = target?.getBoundingClientRect();
    const spotlightStyle = rect
      ? `top:${rect.top - 6}px;left:${rect.left - 6}px;width:${rect.width + 12}px;height:${rect.height + 12}px;`
      : 'display:none;';

    const dots = this.steps.map((_, i) => `<span class="tour-dot ${i === this.index ? 'active' : ''}"></span>`).join('');

    overlay.innerHTML = `
      <div id="tourSpotlight" class="tour-spotlight" style="${spotlightStyle}"></div>
      <div id="tourPopup" class="tour-popup">
        <div id="tourStepLabel" class="tour-step-label">Step ${this.index + 1} of ${this.steps.length}</div>
        <h4 id="tourTitle">${step.title}</h4>
        <p id="tourBody">${step.body}</p>
        <div id="tourDots" class="tour-dots">${dots}</div>
        <div class="tour-actions">
          <button id="tourSkip" class="btn btn-ghost" type="button">Skip</button>
          <div class="tour-actions-right">
            <button id="tourPrev" class="btn btn-ghost" type="button" ${this.index === 0 ? 'disabled' : ''}>Back</button>
            <button id="tourNext" class="btn btn-primary" type="button">${this.index === this.steps.length - 1 ? 'Done' : 'Next'}</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    this.overlay = overlay;

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    overlay.querySelector('#tourSkip')?.addEventListener('click', () => this.cleanup());
    overlay.querySelector('#tourPrev')?.addEventListener('click', () => { this.index = Math.max(0, this.index - 1); this.render(); });
    overlay.querySelector('#tourNext')?.addEventListener('click', () => {
      if (this.index === this.steps.length - 1) { this.cleanup(); return; }
      this.index += 1;
      this.render();
    });
  }
}
