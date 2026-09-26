import { icon } from '../components/icons';
import { store } from '../state/store';
import { schemaService } from '../services/schemaService';
import { changePassword, resetPasswordToDefault, verifyPassword, DEMO_DEFAULT_PASSWORD_HINT, isUsingDefaultPassword } from '../services/passwordService';
import { renderSchemaManagementSection } from './schemaPage';
import { downloadBlob } from '../utils/dom';

// ============================================================================
// settingsPage — V13.1's "Settings" (renamed from "Admin"). Every capability
// that previously lived under Admin remains reachable here: Security
// (change/reset the operational password), Schema Management (embeds the
// SAME renderSchemaManagementSection() used by Used Schema — no duplicated
// logic, just a second nav entry point), and the Danger Zone (schema-wide
// delete, with an automatic backup download first).
// ============================================================================

export function renderSettingsPage(container: HTMLElement): void {
  function draw(): void {
    const active = schemaService.getActiveSchema();
    container.innerHTML = `
      <section class="page page-settings">
        <h1 class="page-title">${icon('settings')} Settings</h1>
        <p class="page-subtitle">Everything previously available under "Admin" lives here — same functionality, same operational password.</p>

        <h2 class="section-title" data-tour="settings-security">${icon('key', 15)} Security</h2>
        <div class="builder-panel narrow">
          <p class="hint">${isUsingDefaultPassword() ? `Currently using the demo default password: <code>${DEMO_DEFAULT_PASSWORD_HINT}</code>` : 'A custom password has been set.'}</p>
          <h3>Change Password</h3>
          <label class="block-label">Current password<input type="password" id="oldPwInput" autocomplete="off" /></label>
          <label class="block-label">New password<input type="password" id="newPwInput" autocomplete="off" /></label>
          <div class="row-actions"><button class="btn btn-primary btn-sm" id="changePwBtn">${icon('key', 14)} Change Password</button></div>
          <div id="changePwResult"></div>
          <h3 class="mt">Forgot Password</h3>
          <p class="hint">Resets the operational password back to the documented demo default. In a production deployment this would require identity verification.</p>
          <button class="btn btn-outline btn-sm" id="resetPwBtn">${icon('refresh', 14)} Reset to Default</button>
        </div>

        <h2 class="section-title">${icon('database', 15)} Schema Management &amp; Synchronization</h2>
        <div class="builder-panel">
          <div id="settingsSchemaMgmtMount"></div>
          <div class="row-actions mt"><button class="btn btn-outline btn-sm" id="openEditorFromSettingsBtn">${icon('grid', 14)} Open Manual Schema Editor</button></div>
        </div>

        <h2 class="section-title" data-tour="settings-danger">${icon('shield-alert', 15)} Danger Zone</h2>
        <div class="builder-panel">
          <p class="hint">Permanently remove every table, column, and relationship from the active schema (<strong>${active.name}</strong>). A full backup is downloaded automatically before anything is deleted.</p>
          <button class="btn btn-danger btn-sm" id="wipeSchemaBtn">${icon('trash', 14)} Delete Schema Contents</button>
          <div id="wipeResult"></div>
        </div>
      </section>`;

    wireEvents();
    const mgmtMount = container.querySelector<HTMLElement>('#settingsSchemaMgmtMount');
    if (mgmtMount) renderSchemaManagementSection(mgmtMount, draw);
  }

  function wireEvents(): void {
    container.querySelector('#changePwBtn')?.addEventListener('click', async () => {
      const oldPw = container.querySelector<HTMLInputElement>('#oldPwInput')?.value || '';
      const newPw = container.querySelector<HTMLInputElement>('#newPwInput')?.value || '';
      const resultMount = container.querySelector('#changePwResult');
      const result = await changePassword(oldPw, newPw);
      if (!resultMount) return;
      if (result.ok) {
        resultMount.innerHTML = `<div class="issue-box mini ok">${icon('check', 14)} Password changed successfully.</div>`;
        store.pushToast('success', 'Operational password changed.');
        (container.querySelector<HTMLInputElement>('#oldPwInput')!).value = '';
        (container.querySelector<HTMLInputElement>('#newPwInput')!).value = '';
      } else {
        resultMount.innerHTML = `<div class="issue-box mini">${icon('alert-triangle', 14)} ${result.error}</div>`;
      }
    });

    container.querySelector('#resetPwBtn')?.addEventListener('click', () => {
      resetPasswordToDefault();
      store.pushToast('info', 'Password reset to the demo default.');
      draw();
    });

    container.querySelector('#openEditorFromSettingsBtn')?.addEventListener('click', () => { window.location.hash = 'schema-editor'; });

    container.querySelector('#wipeSchemaBtn')?.addEventListener('click', async () => {
      const wipeResult = container.querySelector('#wipeResult');
      if (!wipeResult) return;
      wipeResult.innerHTML = `
        <div class="issue-box mini">
          <div>${icon('alert-triangle', 14)} This will permanently remove ALL tables/columns from the active schema. Enter the operational password to confirm.</div>
          <label class="block-label mt">Password<input type="password" id="wipePwInput" autocomplete="off" /></label>
          <div class="row-actions"><button class="btn btn-ghost btn-sm" id="wipeCancelBtn">Cancel</button><button class="btn btn-danger btn-sm" id="wipeConfirmBtn">${icon('trash', 14)} Confirm Delete</button></div>
        </div>`;
      container.querySelector('#wipeCancelBtn')?.addEventListener('click', () => { wipeResult.innerHTML = ''; });
      container.querySelector('#wipeConfirmBtn')?.addEventListener('click', async () => {
        const pw = container.querySelector<HTMLInputElement>('#wipePwInput')?.value || '';
        const ok = await verifyPassword(pw);
        if (!ok) { wipeResult.innerHTML = `<div class="issue-box mini">${icon('alert-triangle', 14)} Incorrect password.</div>`; return; }
        const active = schemaService.getActiveSchema();
        const backup = schemaService.deleteAllSchemaContents(active.id);
        downloadBlob(`schema-backup-${active.id}-${Date.now()}.json`, backup, 'application/json');
        store.pushToast('success', 'Schema contents deleted. A backup was downloaded automatically.');
        wipeResult.innerHTML = '';
        draw();
      });
    });
  }

  draw();
}
