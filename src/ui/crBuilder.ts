import type { SchemaModel, CrQueryConfig, CrQueryType, Dialect, FilterOperator } from '../types';
import { icon } from './icons';
import { buildCrSQL } from '../engines/crEngine';
import { validateCr } from '../engines/validationEngine';
import { FILTER_OPERATORS, requiresValue } from '../engines/filterEngine';

let uid = 0;
const nextId = () => `c${Date.now()}_${uid++}`;

function emptyConfig(): CrQueryConfig {
  return { dialect: 'Oracle', queryType: 'UPDATE', table: null, values: [], filters: [], confirmNoWhere: false };
}

export function renderCrBuilder(schema: SchemaModel): HTMLElement {
  const config = emptyConfig();
  const el = document.createElement('section');
  el.className = 'page page-builder';

  function tableOptions(): string {
    const modules = Array.from(new Set(schema.tables.map((t) => t.module)));
    return modules
      .map((m) => `<optgroup label="${m}">${schema.tables.filter((t) => t.module === m).map((t) => `<option value="${t.name}" ${t.name === config.table ? 'selected' : ''}>${t.name}</option>`).join('')}</optgroup>`)
      .join('');
  }

  function columnsForTable(): { col: string }[] {
    const t = schema.tables.find((x) => x.name === config.table);
    return t ? t.columns.map((c) => ({ col: c.name })) : [];
  }

  function render(): void {
    const issues = validateCr(config);
    const result = buildCrSQL(config, schema);
    const needsWhere = config.queryType !== 'INSERT';

    el.innerHTML = `
      <h1 class="page-title">${icon('code')} Query Builder for CR <span class="badge">Change Request</span></h1>
      <p class="page-subtitle">Generated SQL only — this application does not execute database changes. Review and copy the SQL, then run it through your normal change process.</p>

      <div class="builder-grid">
        <div class="builder-panel">
          <label class="inline-label">SQL dialect
            <select id="dialectSelect">${dialectOptions()}</select>
          </label>

          <h2>Query Type</h2>
          <div class="segmented" id="queryTypeSeg">
            ${(['INSERT', 'UPDATE', 'DELETE'] as CrQueryType[]).map((qt) => `<button type="button" data-qt="${qt}" class="seg-btn ${config.queryType === qt ? 'active' : ''}">${qt}</button>`).join('')}
          </div>

          <h2>Pick Table</h2>
          <select id="tableSelect">
            <option value="">— choose a table —</option>
            ${tableOptions()}
          </select>

          <h2>${config.queryType === 'UPDATE' ? 'Columns to Set' : config.queryType === 'INSERT' ? 'Columns &amp; Values' : 'Values'} </h2>
          ${config.queryType === 'DELETE' ? '<p class="hint">DELETE only needs a WHERE condition below — no column values required.</p>' : `
          <div id="valuesList" class="mini-list"></div>
          <button id="addValueBtn" class="btn btn-outline btn-sm" ${config.table ? '' : 'disabled'}>${icon('plus', 14)} Add column</button>`}

          <h2>Filters <span class="optional">WHERE Conditions</span></h2>
          ${needsWhere ? '<div class="issue-box mini">⚠️ A WHERE condition is required to identify which records should be updated or deleted.</div>' : ''}
          <div id="filtersList" class="mini-list"></div>
          <button id="addFilterBtn" class="btn btn-outline btn-sm" ${config.table ? '' : 'disabled'}>${icon('plus', 14)} Add Filter</button>
          ${needsWhere ? `<label class="inline-check"><input type="checkbox" id="confirmNoWhere" ${config.confirmNoWhere ? 'checked' : ''}/> I explicitly confirm this query should have no WHERE condition</label>` : ''}

          ${issues.length ? `<div class="issue-box">${icon('alert-triangle', 15)}<ul>${issues.map((i) => `<li>${i}</li>`).join('')}</ul></div>` : ''}
        </div>

        <div class="builder-panel">
          <h2>Generated SQL</h2>
          <pre class="sql-output" id="sqlOutput">${escapeHtml(result.sql)}</pre>
          ${result.blocked ? `<div class="issue-box mini">${icon('lock', 14)} ${result.reason ?? 'Query blocked pending required information.'}</div>` : ''}
          <div class="row-actions">
            <button id="copyBtn" class="btn btn-outline btn-sm" ${result.blocked ? 'disabled' : ''}>${icon('copy', 14)} Copy Result</button>
          </div>
        </div>
      </div>`;

    wireEvents();
  }

  function dialectOptions(): string {
    const list: Dialect[] = ['SQL Server', 'Oracle', 'PostgreSQL', 'MySQL', 'Generic'];
    return list.map((d) => `<option value="${d}" ${d === config.dialect ? 'selected' : ''}>${d}</option>`).join('');
  }

  function wireEvents(): void {
    el.querySelector<HTMLSelectElement>('#dialectSelect')?.addEventListener('change', (e) => { config.dialect = (e.target as HTMLSelectElement).value as Dialect; updateOutputOnly(); });

    el.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        config.queryType = btn.dataset.qt as CrQueryType;
        render();
      });
    });

    el.querySelector<HTMLSelectElement>('#tableSelect')?.addEventListener('change', (e) => {
      config.table = (e.target as HTMLSelectElement).value || null;
      config.values = [];
      config.filters = [];
      render();
    });

    el.querySelector('#addValueBtn')?.addEventListener('click', () => {
      const cols = columnsForTable();
      if (cols.length === 0) return;
      config.values.push({ id: nextId(), column: cols[0].col, value: '' });
      render();
    });

    el.querySelector('#addFilterBtn')?.addEventListener('click', () => {
      const cols = columnsForTable();
      if (cols.length === 0 || !config.table) return;
      config.filters.push({ id: nextId(), table: config.table, column: cols[0].col, operator: '=', value: '', combinator: 'AND' });
      render();
    });

    el.querySelector<HTMLInputElement>('#confirmNoWhere')?.addEventListener('change', (e) => {
      config.confirmNoWhere = (e.target as HTMLInputElement).checked;
      updateOutputOnly();
    });

    el.querySelector('#copyBtn')?.addEventListener('click', () => {
      const text = el.querySelector('#sqlOutput')?.textContent || '';
      navigator.clipboard?.writeText(text).catch(() => {});
      flashButton('#copyBtn', 'Copied!');
    });

    renderValuesList();
    renderFiltersList();
  }

  function flashButton(sel: string, text: string): void {
    const btn = el.querySelector<HTMLButtonElement>(sel);
    if (!btn) return;
    const original = btn.innerHTML;
    btn.textContent = text;
    setTimeout(() => { btn.innerHTML = original; }, 1200);
  }

  function updateOutputOnly(): void {
    const result = buildCrSQL(config, schema);
    const out = el.querySelector('#sqlOutput');
    if (out) out.textContent = result.sql;
    const copyBtn = el.querySelector<HTMLButtonElement>('#copyBtn');
    if (copyBtn) copyBtn.disabled = result.blocked;
  }

  function renderValuesList(): void {
    const list = el.querySelector('#valuesList');
    if (!list) return;
    const cols = columnsForTable();
    list.innerHTML = config.values
      .map(
        (v, idx) => `
      <div class="mini-row" data-idx="${idx}">
        <select class="value-col-select">${cols.map((c) => `<option value="${c.col}" ${c.col === v.column ? 'selected' : ''}>${c.col}</option>`).join('')}</select>
        <input type="text" class="value-val-input" placeholder="value" value="${v.value}" />
        <button class="icon-btn remove-btn" title="Remove">${icon('trash', 14)}</button>
      </div>`
      )
      .join('');

    list.querySelectorAll<HTMLElement>('.mini-row').forEach((row) => {
      const idx = parseInt(row.dataset.idx || '0', 10);
      row.querySelector('.value-col-select')?.addEventListener('change', (e) => { config.values[idx].column = (e.target as HTMLSelectElement).value; updateOutputOnly(); });
      row.querySelector('.value-val-input')?.addEventListener('input', (e) => { config.values[idx].value = (e.target as HTMLInputElement).value; updateOutputOnly(); });
      row.querySelector('.remove-btn')?.addEventListener('click', () => { config.values.splice(idx, 1); render(); });
    });
  }

  function renderFiltersList(): void {
    const list = el.querySelector('#filtersList');
    if (!list) return;
    const cols = columnsForTable();
    list.innerHTML = config.filters
      .map((f, idx) => {
        const needsVal = requiresValue(f.operator);
        return `
        <div class="mini-row wrap" data-idx="${idx}">
          ${idx > 0 ? `<select class="combinator-select">
            <option value="AND" ${f.combinator === 'AND' ? 'selected' : ''}>AND</option>
            <option value="OR" ${f.combinator === 'OR' ? 'selected' : ''}>OR</option>
          </select>` : '<span class="hint">WHERE</span>'}
          <select class="filter-col-select">${cols.map((c) => `<option value="${c.col}" ${c.col === f.column ? 'selected' : ''}>${c.col}</option>`).join('')}</select>
          <select class="filter-op-select">${FILTER_OPERATORS.map((op) => `<option value="${op}" ${op === f.operator ? 'selected' : ''}>${op}</option>`).join('')}</select>
          ${needsVal ? `<input type="text" class="filter-val-input" placeholder="value" value="${f.value}" />` : ''}
          <button class="icon-btn remove-btn" title="Remove">${icon('trash', 14)}</button>
        </div>`;
      })
      .join('');

    list.querySelectorAll<HTMLElement>('.mini-row').forEach((row) => {
      const idx = parseInt(row.dataset.idx || '0', 10);
      row.querySelector('.combinator-select')?.addEventListener('change', (e) => { config.filters[idx].combinator = (e.target as HTMLSelectElement).value as any; updateOutputOnly(); });
      row.querySelector('.filter-col-select')?.addEventListener('change', (e) => { config.filters[idx].column = (e.target as HTMLSelectElement).value; updateOutputOnly(); });
      row.querySelector('.filter-op-select')?.addEventListener('change', (e) => { config.filters[idx].operator = (e.target as HTMLSelectElement).value as FilterOperator; render(); });
      row.querySelector('.filter-val-input')?.addEventListener('input', (e) => { config.filters[idx].value = (e.target as HTMLInputElement).value; updateOutputOnly(); });
      row.querySelector('.remove-btn')?.addEventListener('click', () => { config.filters.splice(idx, 1); render(); });
    });
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  render();
  return el;
}
