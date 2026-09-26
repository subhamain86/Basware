import type { SchemaModel, TableDef } from '../types';
import { icon } from './icons';
import { decodeLegend } from '../engines/decodeEngine';
import { saveSchema, resetSchema, DEMO_SCHEMA_PASSWORD } from '../data/schema';

export function renderUsedSchema(schema: SchemaModel): HTMLElement {
  const el = document.createElement('section');
  el.className = 'page page-schema';

  function tableCard(t: TableDef): string {
    return `
    <div class="schema-table-card">
      <div class="schema-table-head">
        <span class="icon-badge">${icon('table', 16)}</span>
        <div>
          <h3>${t.name}</h3>
          <span class="hint">${t.module} · ${t.description}</span>
        </div>
      </div>
      <table class="schema-col-table">
        <thead><tr><th>Column</th><th>Type</th><th>Nullable</th><th>Keys</th><th>Decode</th></tr></thead>
        <tbody>
          ${t.columns
            .map(
              (c) => `<tr>
              <td>${c.name}</td>
              <td>${c.type}${c.length ? `(${c.length})` : ''}</td>
              <td>${c.nullable ? 'Yes' : 'No'}</td>
              <td>${c.pk ? '<span class="chip chip-pk">PK</span>' : ''}${c.fk ? `<span class="chip chip-fk">FK → ${c.fk.table}.${c.fk.column}</span>` : ''}</td>
              <td>${c.decode ? `<span class="hint">${decodeLegend(c)}</span>` : ''}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
  }

  function apply(filter: string): void {
    const list = el.querySelector('#schemaResults');
    if (!list) return;
    const term = filter.trim().toLowerCase();
    const filtered = schema.tables.filter((t) => {
      if (!term) return true;
      if (t.name.toLowerCase().includes(term) || t.module.toLowerCase().includes(term)) return true;
      return t.columns.some((c) => c.name.toLowerCase().includes(term));
    });
    list.innerHTML = filtered.length
      ? filtered.map(tableCard).join('')
      : '<p class="hint">No tables or columns match your search.</p>';
  }

  el.innerHTML = `
    <h1 class="page-title">${icon('database')} Used Schema</h1>
    <p class="page-subtitle">Version ${schema.version} · last updated ${new Date(schema.updatedAt).toLocaleString()}</p>
    <div class="search-row">
      ${icon('search', 16)}
      <input type="text" id="schemaSearch" placeholder="Search tables or columns…" />
      <button id="clearSearch" class="btn btn-ghost btn-sm">Clear</button>
    </div>
    <div id="schemaResults" class="schema-results"></div>`;

  el.querySelector<HTMLInputElement>('#schemaSearch')?.addEventListener('input', (e) => apply((e.target as HTMLInputElement).value));
  el.querySelector('#clearSearch')?.addEventListener('click', () => {
    const input = el.querySelector<HTMLInputElement>('#schemaSearch');
    if (input) input.value = '';
    apply('');
  });

  apply('');
  return el;
}

export function renderUpdateSchema(schema: SchemaModel, onSchemaChanged: (s: SchemaModel) => void): HTMLElement {
  const el = document.createElement('section');
  el.className = 'page page-schema';
  let unlocked = false;

  function renderLocked(): void {
    el.innerHTML = `
      <h1 class="page-title">${icon('lock')} Update Schema</h1>
      <p class="page-subtitle">This is a password-protected administrator action. It never connects to a production database.</p>
      <div class="builder-panel narrow">
        <label class="block-label">Administrator password
          <input type="password" id="pwInput" placeholder="Enter password" />
        </label>
        <button id="unlockBtn" class="btn btn-primary">Unlock</button>
        <p id="pwError" class="issue-box mini" hidden>Incorrect password.</p>
        <p class="hint">Demo password: <code>${DEMO_SCHEMA_PASSWORD}</code></p>
      </div>`;

    el.querySelector('#unlockBtn')?.addEventListener('click', () => {
      const val = el.querySelector<HTMLInputElement>('#pwInput')?.value || '';
      if (val === DEMO_SCHEMA_PASSWORD) {
        unlocked = true;
        renderUnlocked();
      } else {
        el.querySelector('#pwError')?.removeAttribute('hidden');
      }
    });
  }

  function downloadBlob(filename: string, content: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function schemaToCsv(s: SchemaModel): string {
    const header = 'Module,Table Name,Table Description,Column Name,Column Description,Data Type,Length,Nullable,Primary Key,Foreign Key,Decode';
    const rows = s.tables.flatMap((t) =>
      t.columns.map((c) =>
        [
          t.module,
          t.name,
          t.description,
          c.name,
          c.description,
          c.type,
          c.length ?? '',
          c.nullable ? 'Y' : 'N',
          c.pk ? 'Y' : 'N',
          c.fk ? `${c.fk.table}.${c.fk.column}` : '',
          c.decode ? Object.entries(c.decode).map(([k, v]) => `${k}=${v}`).join(';') : ''
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
    );
    return [header, ...rows].join('\n');
  }

  function renderUnlocked(): void {
    el.innerHTML = `
      <h1 class="page-title">${icon('database')} Update Schema</h1>
      <p class="page-subtitle">Unlocked for this session. Changes are stored locally in this browser.</p>

      <div class="builder-grid">
        <div class="builder-panel">
          <h2>${icon('download', 16)} Download Current Schema</h2>
          <div class="row-actions wrap">
            <button class="btn btn-outline btn-sm" id="dlJson">Current Schema (.json)</button>
            <button class="btn btn-outline btn-sm" id="dlCsv">Current Schema (.csv)</button>
          </div>

          <h2>${icon('upload', 16)} Smart Schema Import Engine</h2>
          <p class="hint">Expected columns: Module, Table Name, Table Description, Column Name, Column Description, Data Type, Length, Nullable, Primary Key, Foreign Key, Decode.</p>
          <input type="file" id="importFile" accept=".json,.csv" />
          <div id="importPreview"></div>

          <h2>${icon('alert-triangle', 16)} Danger Zone</h2>
          <p class="hint">Permanently remove every table, column, and relationship from the active schema. A backup is downloaded automatically first.</p>
          <button class="btn btn-danger btn-sm" id="deleteSchemaBtn">Delete Current Schema</button>
        </div>

        <div class="builder-panel">
          <h2>Active Tables (${schema.tables.length})</h2>
          <ul class="mini-list">
            ${schema.tables.map((t) => `<li>${t.name} <span class="hint">— ${t.columns.length} columns · ${t.module}</span></li>`).join('')}
          </ul>
        </div>
      </div>`;

    el.querySelector('#dlJson')?.addEventListener('click', () => downloadBlob('ap-sql-schema.json', JSON.stringify(schema, null, 2), 'application/json'));
    el.querySelector('#dlCsv')?.addEventListener('click', () => downloadBlob('ap-sql-schema.csv', schemaToCsv(schema), 'text/csv'));

    el.querySelector<HTMLInputElement>('#importFile')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      const preview = el.querySelector('#importPreview');
      if (!file || !preview) return;
      const text = await file.text();
      try {
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text) as SchemaModel;
          preview.innerHTML = `<div class="issue-box mini ok">${icon('check', 14)} Parsed ${parsed.tables?.length ?? 0} tables. <button id="applyImport" class="btn btn-primary btn-sm">Apply Schema Update</button></div>`;
          el.querySelector('#applyImport')?.addEventListener('click', () => {
            saveSchema(parsed);
            onSchemaChanged(parsed);
          });
        } else {
          preview.innerHTML = `<div class="issue-box mini ok">${icon('check', 14)} CSV received (${text.split('\n').length - 1} rows). Convert to JSON schema format before applying, or contact your schema owner.</div>`;
        }
      } catch (err) {
        preview.innerHTML = `<div class="issue-box mini">${icon('alert-triangle', 14)} Could not parse file: ${(err as Error).message}</div>`;
      }
    });

    el.querySelector('#deleteSchemaBtn')?.addEventListener('click', () => {
      downloadBlob('schema-backup-before-delete.json', JSON.stringify(schema, null, 2), 'application/json');
      const fresh = resetSchema();
      onSchemaChanged(fresh);
    });
  }

  if (unlocked) renderUnlocked(); else renderLocked();
  return el;
}
