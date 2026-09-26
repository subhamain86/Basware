import { icon } from '../components/icons';
import { aiService } from '../services/aiService';
export function renderAboutPage(container: HTMLElement): void {
  container.innerHTML = `
    <section class="page page-about" data-tour="about-panel">
      <h1 class="page-title">${icon('info')} About AP-SQL Assistant</h1>
      <div class="builder-panel narrow">
        <p>AP-SQL Assistant is a self-contained tool that helps AP and P2P support teams construct accurate SQL
        without needing deep, memorized knowledge of the underlying database schema.</p>
        <p><strong>Version 13.1</strong> evolves the V11.9 baseline: navigation now lives in a single Hamburger
        Menu, "Admin" is renamed to "Settings" (same functionality, same password), and a brand-new
        <strong>Manual Schema Editor</strong> lets you add, edit, and delete schema tables/columns directly from
        the browser — fully integrated with the same active-schema state used by the Query Builder, AI engines,
        and Error Rectifier.</p>
        <pre class="sql-output">UI (pages/, components/)
  ↓
Application State (state/store.ts)
  ↓
Service Layer (services/aiService.ts, services/schemaService.ts, services/passwordService.ts)
  ↓
Engines (sqlEngine, crEngine, nlpEngine, validationEngine, errorRectifierEngine, optimizeEngine,
         decodeEngine, filterEngine, schemaIntegrityEngine)</pre>
        <p><strong>Current AI provider:</strong> ${aiService.providerName} (${aiService.isAvailable ? 'available' : 'unavailable'}).</p>
        <p>The application is strictly a SQL-text generator. It never opens a database connection, and it never
        executes a query. The Read Only Query Builder blocks destructive SQL at the engine level, and the Manual
        Schema Editor's delete action requires three separate confirmations, the last of which requires the
        operational password (SHA-256 hashed, never stored or logged in plain text).</p>
        <p class="hint">Crafted by Subham Ain · Senior Support Consultant</p>
      </div>
    </section>`;
}
