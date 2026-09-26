import { icon } from './icons';
import { rectify } from '../engines/errorRectifierEngine';
import type { Dialect } from '../types';

export function renderErrorRectifier(): HTMLElement {
  const el = document.createElement('section');
  el.className = 'page page-error';
  let dialect: Dialect = 'Oracle';

  el.innerHTML = `
    <h1 class="page-title">${icon('bug')} Error Rectifier</h1>
    <p class="page-subtitle">SQL generated for review only. AP-SQL Assistant does not execute database changes.</p>

    <div class="builder-grid">
      <div class="builder-panel">
        <h2>Enter Database Error</h2>
        <textarea id="errText" rows="4" placeholder="Paste the exact error message from your database, e.g. ORA-00904: &quot;VENDR_ID&quot;: invalid identifier"></textarea>

        <h2>Enter Current SQL Query</h2>
        <textarea id="sqlText" rows="8" placeholder="Paste the SQL statement that produced the error"></textarea>

        <label class="inline-label">SQL dialect <span class="hint">auto-detected from the pasted error where possible</span>
          <select id="dialectSelect">
            ${(['SQL Server', 'Oracle', 'PostgreSQL', 'MySQL', 'Generic'] as Dialect[]).map((d) => `<option value="${d}" ${d === dialect ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </label>

        <button id="rectifyBtn" class="btn btn-primary">Rectify SQL</button>
      </div>

      <div class="builder-panel">
        <h2>Rectified SQL</h2>
        <pre class="sql-output" id="rectifiedOutput">Paste a database error and the SQL that produced it above, then select Rectify SQL.</pre>
        <div class="row-actions">
          <button id="copySqlBtn" class="btn btn-outline btn-sm">${icon('copy', 14)} Copy SQL</button>
        </div>

        <h2>Explanation</h2>
        <div class="explanation-box" id="explanationBox">—</div>
        <div class="row-actions">
          <button id="copyExplBtn" class="btn btn-outline btn-sm">${icon('copy', 14)} Copy Explanation</button>
        </div>

        <h2>What Changed</h2>
        <ul class="mini-list" id="whatChangedList"><li class="hint">—</li></ul>
      </div>
    </div>`;

  const errText = el.querySelector<HTMLTextAreaElement>('#errText')!;
  const sqlText = el.querySelector<HTMLTextAreaElement>('#sqlText')!;
  const dialectSelect = el.querySelector<HTMLSelectElement>('#dialectSelect')!;
  const rectifiedOutput = el.querySelector<HTMLElement>('#rectifiedOutput')!;
  const explanationBox = el.querySelector<HTMLElement>('#explanationBox')!;
  const whatChangedList = el.querySelector<HTMLElement>('#whatChangedList')!;

  dialectSelect.addEventListener('change', () => { dialect = dialectSelect.value as Dialect; });

  el.querySelector('#rectifyBtn')?.addEventListener('click', () => {
    const errorVal = errText.value.trim();
    const sqlVal = sqlText.value.trim();
    if (!errorVal || !sqlVal) {
      rectifiedOutput.textContent = 'Please provide both the database error and the SQL query that produced it.';
      explanationBox.textContent = '—';
      whatChangedList.innerHTML = '<li class="hint">—</li>';
      return;
    }
    const result = rectify(errorVal, sqlVal);
    if (result.detectedDialect) {
      dialect = result.detectedDialect;
      dialectSelect.value = dialect;
    }
    rectifiedOutput.textContent = result.correctedSql;
    explanationBox.textContent = result.explanation;
    whatChangedList.innerHTML = result.whatChanged.length
      ? result.whatChanged.map((c) => `<li>${escapeHtml(c)}</li>`).join('')
      : '<li class="hint">No changes were necessary.</li>';
  });

  el.querySelector('#copySqlBtn')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(rectifiedOutput.textContent || '').catch(() => {});
  });
  el.querySelector('#copyExplBtn')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(explanationBox.textContent || '').catch(() => {});
  });

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return el;
}
