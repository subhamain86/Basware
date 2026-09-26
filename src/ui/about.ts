import { icon } from './icons';

export function renderAbout(): HTMLElement {
  const el = document.createElement('section');
  el.className = 'page page-about';
  el.innerHTML = `
    <h1 class="page-title">${icon('info')} About AP-SQL Assistant</h1>
    <div class="builder-panel narrow">
      <p>AP-SQL Assistant is a self-contained tool that helps AP (Accounts Payable) and P2P (Procure-to-Pay) support
      and technical teams construct accurate SQL without needing deep, memorized knowledge of the underlying database
      schema.</p>
      <p>Version 12.0 rebuilds the application on <strong>TypeScript + Vite</strong>, keeping the same feature set:
      the Read Only Query Builder, Query Builder for Change Requests, schema-aware Error Rectifier, an editable and
      importable schema, a Guided Walkthrough, and a System / Light / Dark theme.</p>
      <p>The application is strictly a SQL-text generator. It never opens a database connection, and it never
      executes a query — every statement is produced for human review before use.</p>
      <p class="hint">Crafted by Subham Ain · Senior Support Consultant</p>
    </div>`;
  return el;
}
