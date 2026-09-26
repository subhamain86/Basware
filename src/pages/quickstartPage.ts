import { icon } from '../components/icons';
import { schemaService } from '../services/schemaService';
import type { Route } from '../types';
export function renderQuickstartPage(container: HTMLElement, onNavigate: (r: Route) => void): void {
  const schema = schemaService.getActiveSchema(); const modules = Array.from(new Set(schema.tables.map((t) => t.module)));
  container.innerHTML = `
    <section class="page page-quickstart">
      <div class="hero-card">
        <h1>Welcome — what does this tool do?</h1>
        <p class="lead">AP-SQL Assistant · Version 13.1. This assistant writes database queries for you — both
        read-only reports and Change Request SQL (INSERT / UPDATE / DELETE text) — using your organization's active
        schema as its single source of truth, and helps you correct a SQL query when a database gives you back an
        error. Describe what you need in plain language, make manual selections, or combine both. Navigation now
        lives in the hamburger menu — select the ☰ icon in the top-right to get started.</p>
      </div>
      <h2 class="section-title">${icon('database')} Active schema: ${schema.name}</h2>
      <div class="chip-row">${modules.map((m) => `<span class="chip">${m}</span>`).join('')}</div>
      <h2 class="section-title">${icon('play')} Try an example</h2>
      <div class="card-grid">
        <div class="feature-card" data-nav="readonly"><div class="feature-icon">${icon('table', 22)}</div><h3>Read Only Query Builder</h3><p>Describe what you need in plain language and select Build Query, make manual selections, or combine both.</p><span class="card-link">Open ${icon('arrow-right', 16)}</span></div>
        <div class="feature-card" data-nav="cr"><div class="feature-icon">${icon('code', 22)}</div><h3>Query Builder for CR <span class="badge">CR</span></h3><p>Build INSERT / UPDATE / DELETE SQL for Change Requests, with mandatory-WHERE safeguards.</p><span class="card-link">Open ${icon('arrow-right', 16)}</span></div>
        <div class="feature-card" data-nav="schema-editor"><div class="feature-icon">${icon('grid', 22)}</div><h3>Manual Schema Editor <span class="badge">NEW</span></h3><p>Add, edit, and delete schema tables/columns directly, with full validation and three-level delete protection.</p><span class="card-link">Open ${icon('arrow-right', 16)}</span></div>
        <div class="feature-card" data-nav="error-rectifier"><div class="feature-icon">${icon('bug', 22)}</div><h3>Error Rectifier</h3><p>Paste a database error and the SQL that caused it to get a corrected query and explanation.</p><span class="card-link">Open ${icon('arrow-right', 16)}</span></div>
      </div>
      <div class="note-box">${icon('shield', 16)}<div><strong>No execution, ever.</strong> AP-SQL Assistant only ever produces SQL text for you to review and copy. It never connects to a real database and never executes a query.</div></div>
    </section>`;
  container.querySelectorAll<HTMLElement>('[data-nav]').forEach((c) => c.addEventListener('click', () => onNavigate(c.dataset.nav as Route)));
}
