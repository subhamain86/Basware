import type { SchemaModel, ReadOnlyQueryConfig, Dialect, FilterOperator } from '../types';
import { icon } from './icons';
import { buildSelectSQL } from '../engines/sqlEngine';
import { validateReadOnly } from '../engines/validationEngine';
import { optimizeSuggestions } from '../engines/optimizeEngine';
import { FILTER_OPERATORS, requiresValue } from '../engines/filterEngine';

let uid = 0;
const nextId = () => `f${Date.now()}_${uid++}`;

function emptyConfig(): ReadOnlyQueryConfig {
  return {
    dialect: 'Oracle',
    primaryTable: null,
    columns: [],
    joins: [],
    filters: [],
    sorts: [],
    limit: null,
    distinct: false,
    saveAsView: null,
    onlyMatching: true,
    havingClause: '',
    recursive: false
  };
}

function applyNaturalLanguage(desc: string, schema: SchemaModel, config: ReadOnlyQueryConfig): void {
  const upper = desc.toUpperCase();
  const table = schema.tables.find((t) => upper.includes(t.name.replace(/_/g, ' ')) || upper.includes(t.name));
  if (table && !config.primaryTable) config.primaryTable = table.name;
  const limitMatch = desc.match(/\b(?:top|first|limit)\s+(\d+)/i);
  if (limitMatch) config.limit = parseInt(limitMatch[1], 10);
  if (/distinct/i.test(desc)) config.distinct = true;
}

export function renderReadOnlyBuilder(schema: SchemaModel): HTMLElement {
  const config = emptyConfig();
  const el = document.createElement('section');
  el.className = 'page page-builder';

  function tableOptions(selected: string | null): string {
    const modules = Array.from(new Set(schema.tables.map((t) => t.module)));
    return modules
      .map((m) => `<optgroup label="${m}">${schema.tables
        .filter((t) => t.module === m)
        .map((t) => `<option value="${t.name}" ${t.name === selected ? 'selected' : ''}>${t.name}</option>`)
        .join('')}</optgroup>`)
      .join('');
  }

  function columnOptionsFor(tableName: string | null): { table: string; col: string; label: string }[] {
    if (!tableName) return [];
    const t = schema.tables.find((x) => x.name === tableName);
    if (!t) return [];
    return t.columns.map((c) => ({ table: t.name, col: c.name, label: `${t.name}.${c.name}` }));
  }

  function allJoinableColumns(): { table: string; col: string; label: string }[] {
    const tables = [config.primaryTable, ...config.joins.map((j) => j.table)].filter(Boolean) as string[];
    return tables.flatMap((t) => columnOptionsFor(t));
  }

  function render(): void {
    const issues = validateReadOnly(config);
    const sql = buildSelectSQL(config, schema);
    const tips = config.primaryTable ? optimizeSuggestions(config) : [];

    el.innerHTML = `
      <h1 class="page-title">${icon('table')} Read Only Query Builder</h1>
      <p class="page-subtitle">Generates validated SELECT / WITH statements only — with joins, multi-column filters, sorting, limits, decode and CTEs.</p>

      <div class="builder-grid">
        <div class="builder-panel">
          <h2>Describe What You Need <span class="optional">(optional)</span></h2>
          <textarea id="nlDesc" rows="3" placeholder="e.g. Show the top 20 open purchase orders for Acme Vendor, sorted by total amount"></textarea>
          <div class="row-actions">
            <label class="inline-label">SQL dialect
              <select id="dialectSelect">${dialectOptions(config.dialect)}</select>
            </label>
            <label class="inline-check"><input type="checkbox" id="distinctCheck" ${config.distinct ? 'checked' : ''}/> Remove duplicates</label>
          </div>
          <button id="nlBuildBtn" class="btn btn-primary">Build Query</button>

          <hr/>

          <h2>Tables &amp; Columns</h2>
          <label class="block-label">Primary table
            <select id="primaryTableSelect">
              <option value="">— choose a table —</option>
              ${tableOptions(config.primaryTable)}
            </select>
          </label>

          <div id="columnsList" class="mini-list"></div>
          <button id="addColumnBtn" class="btn btn-outline btn-sm" ${config.primaryTable ? '' : 'disabled'}>${icon('plus', 14)} Add column</button>

          <h2>Joins</h2>
          <div id="joinsList" class="mini-list"></div>
          <button id="addJoinBtn" class="btn btn-outline btn-sm" ${config.primaryTable ? '' : 'disabled'}>${icon('plus', 14)} Add join</button>

          <h2>Filters <span class="optional">WHERE Conditions</span></h2>
          <div id="filtersList" class="mini-list"></div>
          <button id="addFilterBtn" class="btn btn-outline btn-sm" ${config.primaryTable ? '' : 'disabled'}>${icon('plus', 14)} Add filter</button>

          <h2>Sort the results <span class="optional">ORDER BY</span></h2>
          <div id="sortsList" class="mini-list"></div>
          <button id="addSortBtn" class="btn btn-outline btn-sm" ${config.primaryTable ? '' : 'disabled'}>${icon('plus', 14)} Add sort</button>

          <div class="advanced-options">
            <h2>Advanced Options</h2>
            <label class="block-label">Result limit <span class="hint">TOP / LIMIT / FETCH FIRST</span>
              <input type="number" id="limitInput" min="1" value="${config.limit ?? ''}" placeholder="none" />
            </label>
            <label class="block-label">Save as a named view <span class="hint">WITH name AS (...)</span>
              <input type="text" id="viewNameInput" value="${config.saveAsView ?? ''}" placeholder="e.g. recent_pos" />
            </label>
            <label class="block-label">Filter on a total <span class="hint">HAVING, after grouping</span>
              <input type="text" id="havingInput" value="${config.havingClause}" placeholder="e.g. COUNT(*) > 1" />
            </label>
            <label class="inline-check"><input type="checkbox" id="recursiveCheck" ${config.recursive ? 'checked' : ''}/> Explore a hierarchy / org chart <span class="hint">WITH RECURSIVE</span></label>
          </div>

          ${issues.length ? `<div class="issue-box">${icon('alert-triangle', 15)}<ul>${issues.map((i) => `<li>${i}</li>`).join('')}</ul></div>` : ''}
        </div>

        <div class="builder-panel">
          <h2>Generated SQL</h2>
          <pre class="sql-output" id="sqlOutput">${escapeHtml(sql)}</pre>
          <div class="row-actions">
            <button id="copyBtn" class="btn btn-outline btn-sm">${icon('copy', 14)} Copy Result</button>
            <button id="optimizeBtn" class="btn btn-outline btn-sm">${icon('wand', 14)} Optimize</button>
          </div>
          ${tips.length ? `<div class="tips-box" id="tipsBox" hidden>${icon('wand', 15)}<ul>${tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>` : ''}
        </div>
      </div>`;

    wireEvents();
  }

  function dialectOptions(selected: Dialect): string {
    const list: Dialect[] = ['SQL Server', 'Oracle', 'PostgreSQL', 'MySQL', 'Generic'];
    return list.map((d) => `<option value="${d}" ${d === selected ? 'selected' : ''}>${d}</option>`).join('');
  }

  function wireEvents(): void {
    el.querySelector<HTMLTextAreaElement>('#nlDesc')?.addEventListener('input', (e) => {
      (config as any)._nlDesc = (e.target as HTMLTextAreaElement).value;
    });
    el.querySelector('#nlBuildBtn')?.addEventListener('click', () => {
      const desc = el.querySelector<HTMLTextAreaElement>('#nlDesc')?.value || '';
      applyNaturalLanguage(desc, schema, config);
      render();
    });
    el.querySelector<HTMLSelectElement>('#dialectSelect')?.addEventListener('change', (e) => {
      config.dialect = (e.target as HTMLSelectElement).value as Dialect;
      render();
    });
    el.querySelector<HTMLInputElement>('#distinctCheck')?.addEventListener('change', (e) => {
      config.distinct = (e.target as HTMLInputElement).checked;
      render();
    });
    el.querySelector<HTMLSelectElement>('#primaryTableSelect')?.addEventListener('change', (e) => {
      config.primaryTable = (e.target as HTMLSelectElement).value || null;
      config.columns = [];
      config.joins = [];
      config.filters = [];
      config.sorts = [];
      render();
    });

    el.querySelector('#addColumnBtn')?.addEventListener('click', () => {
      if (!config.primaryTable) return;
      config.columns.push({ id: nextId(), table: config.primaryTable, column: columnOptionsFor(config.primaryTable)[0]?.col || '', alias: '', useDecode: false });
      render();
    });
    el.querySelector('#addJoinBtn')?.addEventListener('click', () => {
      const other = schema.tables.find((t) => t.name !== config.primaryTable);
      if (!other) return;
      config.joins.push({ id: nextId(), table: other.name, joinType: 'INNER JOIN', onLeftColumn: schema.tables.find(t=>t.name===config.primaryTable)?.columns[0]?.name || '', onRightColumn: other.columns[0]?.name || '' });
      render();
    });
    el.querySelector('#addFilterBtn')?.addEventListener('click', () => {
      const cols = allJoinableColumns();
      if (cols.length === 0) return;
      config.filters.push({ id: nextId(), table: cols[0].table, column: cols[0].col, operator: '=', value: '', combinator: 'AND' });
      render();
    });
    el.querySelector('#addSortBtn')?.addEventListener('click', () => {
      const cols = allJoinableColumns();
      if (cols.length === 0) return;
      config.sorts.push({ id: nextId(), table: cols[0].table, column: cols[0].col, direction: 'ASC' });
      render();
    });

    el.querySelector<HTMLInputElement>('#limitInput')?.addEventListener('input', (e) => {
      const v = (e.target as HTMLInputElement).value;
      config.limit = v ? parseInt(v, 10) : null;
      updateOutputOnly();
    });
    el.querySelector<HTMLInputElement>('#viewNameInput')?.addEventListener('input', (e) => {
      config.saveAsView = (e.target as HTMLInputElement).value || null;
      updateOutputOnly();
    });
    el.querySelector<HTMLInputElement>('#havingInput')?.addEventListener('input', (e) => {
      config.havingClause = (e.target as HTMLInputElement).value;
      updateOutputOnly();
    });
    el.querySelector<HTMLInputElement>('#recursiveCheck')?.addEventListener('change', (e) => {
      config.recursive = (e.target as HTMLInputElement).checked;
      updateOutputOnly();
    });

    el.querySelector('#copyBtn')?.addEventListener('click', () => {
      const text = el.querySelector('#sqlOutput')?.textContent || '';
      navigator.clipboard?.writeText(text).catch(() => {});
      flashButton('#copyBtn', 'Copied!');
    });
    el.querySelector('#optimizeBtn')?.addEventListener('click', () => {
      el.querySelector('#tipsBox')?.toggleAttribute('hidden');
    });

    renderColumnsList();
    renderJoinsList();
    renderFiltersList();
    renderSortsList();
  }

  function flashButton(sel: string, text: string): void {
    const btn = el.querySelector<HTMLButtonElement>(sel);
    if (!btn) return;
    const original = btn.innerHTML;
    btn.textContent = text;
    setTimeout(() => { btn.innerHTML = original; }, 1200);
  }

  function updateOutputOnly(): void {
    const sql = buildSelectSQL(config, schema);
    const out = el.querySelector('#sqlOutput');
    if (out) out.textContent = sql;
  }

  function renderColumnsList(): void {
    const list = el.querySelector('#columnsList');
    if (!list) return;
    const cols = columnOptionsFor(config.primaryTable);
    list.innerHTML = config.columns
      .map(
        (c, idx) => `
      <div class="mini-row" data-idx="${idx}" data-kind="column">
        <select class="col-select">${cols.map((o) => `<option value="${o.col}" ${o.col === c.column ? 'selected' : ''}>${o.col}</option>`).join('')}</select>
        <input type="text" class="alias-input" placeholder="alias" value="${c.alias}" />
        <label class="inline-check tiny"><input type="checkbox" class="decode-check" ${c.useDecode ? 'checked' : ''}/> Decode</label>
        <button class="icon-btn remove-btn" title="Remove">${icon('trash', 14)}</button>
      </div>`
      )
      .join('');

    list.querySelectorAll<HTMLElement>('.mini-row').forEach((row) => {
      const idx = parseInt(row.dataset.idx || '0', 10);
      row.querySelector('.col-select')?.addEventListener('change', (e) => {
        config.columns[idx].column = (e.target as HTMLSelectElement).value;
        updateOutputOnly();
      });
      row.querySelector('.alias-input')?.addEventListener('input', (e) => {
        config.columns[idx].alias = (e.target as HTMLInputElement).value;
        updateOutputOnly();
      });
      row.querySelector('.decode-check')?.addEventListener('change', (e) => {
        config.columns[idx].useDecode = (e.target as HTMLInputElement).checked;
        updateOutputOnly();
      });
      row.querySelector('.remove-btn')?.addEventListener('click', () => {
        config.columns.splice(idx, 1);
        render();
      });
    });
  }

  function renderJoinsList(): void {
    const list = el.querySelector('#joinsList');
    if (!list) return;
    list.innerHTML = config.joins
      .map((j, idx) => {
        const otherTables = schema.tables.filter((t) => t.name !== config.primaryTable);
        const rightCols = columnOptionsFor(j.table);
        const leftCols = columnOptionsFor(config.primaryTable);
        return `
        <div class="mini-row wrap" data-idx="${idx}">
          <select class="join-type-select">
            <option value="INNER JOIN" ${j.joinType === 'INNER JOIN' ? 'selected' : ''}>INNER JOIN (matching only)</option>
            <option value="LEFT JOIN" ${j.joinType === 'LEFT JOIN' ? 'selected' : ''}>LEFT JOIN (keep unmatched)</option>
          </select>
          <select class="join-table-select">${otherTables.map((t) => `<option value="${t.name}" ${t.name === j.table ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
          <span class="hint">ON ${config.primaryTable}.</span>
          <select class="join-left-select">${leftCols.map((c) => `<option value="${c.col}" ${c.col === j.onLeftColumn ? 'selected' : ''}>${c.col}</option>`).join('')}</select>
          <span class="hint">=  ${j.table}.</span>
          <select class="join-right-select">${rightCols.map((c) => `<option value="${c.col}" ${c.col === j.onRightColumn ? 'selected' : ''}>${c.col}</option>`).join('')}</select>
          <button class="icon-btn remove-btn" title="Remove">${icon('trash', 14)}</button>
        </div>`;
      })
      .join('');

    list.querySelectorAll<HTMLElement>('.mini-row').forEach((row) => {
      const idx = parseInt(row.dataset.idx || '0', 10);
      row.querySelector('.join-type-select')?.addEventListener('change', (e) => { config.joins[idx].joinType = (e.target as HTMLSelectElement).value as any; updateOutputOnly(); });
      row.querySelector('.join-table-select')?.addEventListener('change', (e) => { config.joins[idx].table = (e.target as HTMLSelectElement).value; render(); });
      row.querySelector('.join-left-select')?.addEventListener('change', (e) => { config.joins[idx].onLeftColumn = (e.target as HTMLSelectElement).value; updateOutputOnly(); });
      row.querySelector('.join-right-select')?.addEventListener('change', (e) => { config.joins[idx].onRightColumn = (e.target as HTMLSelectElement).value; updateOutputOnly(); });
      row.querySelector('.remove-btn')?.addEventListener('click', () => { config.joins.splice(idx, 1); render(); });
    });
  }

  function renderFiltersList(): void {
    const list = el.querySelector('#filtersList');
    if (!list) return;
    const cols = allJoinableColumns();
    list.innerHTML = config.filters
      .map((f, idx) => {
        const needsVal = requiresValue(f.operator);
        return `
        <div class="mini-row wrap" data-idx="${idx}">
          ${idx > 0 ? `<select class="combinator-select">
            <option value="AND" ${f.combinator === 'AND' ? 'selected' : ''}>AND</option>
            <option value="OR" ${f.combinator === 'OR' ? 'selected' : ''}>OR</option>
          </select>` : '<span class="hint">WHERE</span>'}
          <select class="filter-col-select">${cols.map((c) => `<option value="${c.table}.${c.col}" ${c.table === f.table && c.col === f.column ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
          <select class="filter-op-select">${FILTER_OPERATORS.map((op) => `<option value="${op}" ${op === f.operator ? 'selected' : ''}>${op}</option>`).join('')}</select>
          ${needsVal ? `<input type="text" class="filter-val-input" placeholder="value" value="${f.value}" />` : ''}
          <button class="icon-btn remove-btn" title="Remove">${icon('trash', 14)}</button>
        </div>`;
      })
      .join('');

    list.querySelectorAll<HTMLElement>('.mini-row').forEach((row) => {
      const idx = parseInt(row.dataset.idx || '0', 10);
      row.querySelector('.combinator-select')?.addEventListener('change', (e) => { config.filters[idx].combinator = (e.target as HTMLSelectElement).value as any; updateOutputOnly(); });
      row.querySelector('.filter-col-select')?.addEventListener('change', (e) => {
        const [t, c] = (e.target as HTMLSelectElement).value.split('.');
        config.filters[idx].table = t;
        config.filters[idx].column = c;
        updateOutputOnly();
      });
      row.querySelector('.filter-op-select')?.addEventListener('change', (e) => { config.filters[idx].operator = (e.target as HTMLSelectElement).value as FilterOperator; render(); });
      row.querySelector('.filter-val-input')?.addEventListener('input', (e) => { config.filters[idx].value = (e.target as HTMLInputElement).value; updateOutputOnly(); });
      row.querySelector('.remove-btn')?.addEventListener('click', () => { config.filters.splice(idx, 1); render(); });
    });
  }

  function renderSortsList(): void {
    const list = el.querySelector('#sortsList');
    if (!list) return;
    const cols = allJoinableColumns();
    list.innerHTML = config.sorts
      .map(
        (s, idx) => `
      <div class="mini-row" data-idx="${idx}">
        <select class="sort-col-select">${cols.map((c) => `<option value="${c.table}.${c.col}" ${c.table === s.table && c.col === s.column ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
        <select class="sort-dir-select">
          <option value="ASC" ${s.direction === 'ASC' ? 'selected' : ''}>ASC</option>
          <option value="DESC" ${s.direction === 'DESC' ? 'selected' : ''}>DESC</option>
        </select>
        <button class="icon-btn remove-btn" title="Remove">${icon('trash', 14)}</button>
      </div>`
      )
      .join('');

    list.querySelectorAll<HTMLElement>('.mini-row').forEach((row) => {
      const idx = parseInt(row.dataset.idx || '0', 10);
      row.querySelector('.sort-col-select')?.addEventListener('change', (e) => {
        const [t, c] = (e.target as HTMLSelectElement).value.split('.');
        config.sorts[idx].table = t;
        config.sorts[idx].column = c;
        updateOutputOnly();
      });
      row.querySelector('.sort-dir-select')?.addEventListener('change', (e) => { config.sorts[idx].direction = (e.target as HTMLSelectElement).value as any; updateOutputOnly(); });
      row.querySelector('.remove-btn')?.addEventListener('click', () => { config.sorts.splice(idx, 1); render(); });
    });
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  render();
  return el;
}
