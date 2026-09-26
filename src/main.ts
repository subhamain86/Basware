import './style.css';
import { initTheme } from './ui/theme';
import { renderNavbar, type Route } from './ui/navbar';
import { renderQuickStart } from './ui/quickstart';
import { renderReadOnlyBuilder } from './ui/readOnlyBuilder';
import { renderCrBuilder } from './ui/crBuilder';
import { renderUsedSchema, renderUpdateSchema } from './ui/schemaPanel';
import { renderErrorRectifier } from './ui/errorRectifier';
import { renderAbout } from './ui/about';
import { GuidedTour, QUICKSTART_TOUR } from './ui/tour';
import { loadSchema } from './data/schema';
import type { SchemaModel } from './types';

initTheme();

let schema: SchemaModel = loadSchema();
const tour = new GuidedTour(QUICKSTART_TOUR);

const app = document.getElementById('app')!;
app.innerHTML = '';

const shell = document.createElement('div');
shell.className = 'app-shell';
const navSlot = document.createElement('div');
const mainSlot = document.createElement('main');
mainSlot.className = 'app-main';
shell.appendChild(navSlot);
shell.appendChild(mainSlot);
app.appendChild(shell);

const footer = document.createElement('footer');
footer.className = 'app-footer';
footer.innerHTML = `<span>AP-SQL Assistant · Version 12.0</span><span class="hint">Crafted by Subham Ain</span>`;
app.appendChild(footer);

function routeFromHash(): Route {
  const h = window.location.hash.replace('#', '') as Route;
  const valid: Route[] = ['quickstart', 'readonly', 'cr', 'schema-used', 'schema-update', 'error', 'about'];
  return valid.includes(h) ? h : 'quickstart';
}

function navigate(route: Route): void {
  window.location.hash = route;
}

function renderPage(route: Route): HTMLElement {
  switch (route) {
    case 'readonly':
      return renderReadOnlyBuilder(schema);
    case 'cr':
      return renderCrBuilder(schema);
    case 'schema-used':
      return renderUsedSchema(schema);
    case 'schema-update':
      return renderUpdateSchema(schema, (s) => {
        schema = s;
        renderAll();
      });
    case 'error':
      return renderErrorRectifier();
    case 'about':
      return renderAbout();
    case 'quickstart':
    default:
      return renderQuickStart(schema, navigate);
  }
}

function renderAll(): void {
  const route = routeFromHash();
  navSlot.innerHTML = '';
  navSlot.appendChild(renderNavbar(route, navigate, () => tour.start()));
  mainSlot.innerHTML = '';
  mainSlot.appendChild(renderPage(route));
}

window.addEventListener('hashchange', renderAll);
renderAll();
