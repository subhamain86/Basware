import { icon } from './icons';
import type { SchemaModel } from '../types';
import type { Route } from './navbar';

export function renderQuickStart(schema: SchemaModel, onNavigate: (r: Route) => void): HTMLElement {
  const el = document.createElement('section');
  el.className = 'page page-quickstart';

  const modules = Array.from(new Set(schema.tables.map((t) => t.module)));

  el.innerHTML = `
    <div class="hero-card">
      <h1>Welcome — what does this tool do?</h1>
      <p class="lead">AP-SQL Assistant · Version 12.0. This assistant writes database queries for you — both read-only
      reports and Change Request SQL (INSERT / UPDATE / DELETE text) — using your organization's approved database
      schema as its single source of truth, and helps you correct a SQL query when a database gives you back an
      error. Build a query by describing what you need in plain language, by making manual selections, or both
      together.</p>
    </div>

    <h2 class="section-title">${icon('database')} Areas covered by the active schema</h2>
    <div class="chip-row">
      ${modules.map((m) => `<span class="chip">${m}</span>`).join('')}
    </div>

    <h2 class="section-title">${icon('play')} Try an example</h2>
    <div class="card-grid">
      <div class="feature-card" data-nav="readonly">
        <div class="feature-icon">${icon('table', 22)}</div>
        <h3>Read Only Query Builder</h3>
        <p>Describe what you need in plain language and click Build Query, make selections manually, or combine both.</p>
        <span class="card-link">Open Read Only Query Builder ${icon('chevron-right', 16)}</span>
      </div>
      <div class="feature-card" data-nav="cr">
        <div class="feature-icon">${icon('code', 22)}</div>
        <h3>Query Builder for CR <span class="badge">CR</span></h3>
        <p>Describe the change in plain language and click Build Query, or use the manual controls.</p>
        <span class="card-link">Open Query Builder for CR ${icon('chevron-right', 16)}</span>
      </div>
      <div class="feature-card" data-nav="error">
        <div class="feature-icon">${icon('bug', 22)}</div>
        <h3>Error Rectifier <span class="badge">V12</span></h3>
        <p>Paste a database error and the SQL that caused it, and get a corrected query with a plain-language explanation.</p>
        <span class="card-link">Open Error Rectifier ${icon('chevron-right', 16)}</span>
      </div>
      <div class="feature-card" data-nav="schema-used">
        <div class="feature-icon">${icon('database', 22)}</div>
        <h3>Schema</h3>
        <p>Browse the active schema, or use an administrator password to update it and import a new one.</p>
        <span class="card-link">Open Schema ${icon('chevron-right', 16)}</span>
      </div>
    </div>

    <div class="note-box">
      ${icon('shield', 16)}
      <div>
        <strong>No execution, ever.</strong> AP-SQL Assistant only ever produces SQL text for you to review and copy.
        It never connects to a real database and never executes a query.
      </div>
    </div>`;

  el.querySelectorAll<HTMLElement>('[data-nav]').forEach((c) => {
    c.addEventListener('click', () => onNavigate(c.dataset.nav as Route));
  });

  return el;
}
