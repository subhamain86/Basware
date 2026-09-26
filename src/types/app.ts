export type Route =
  | 'quickstart' | 'readonly' | 'cr'
  | 'schema-used' | 'schema-editor'
  | 'error-rectifier' | 'settings' | 'about';

export interface NavChildItem { id: Route; label: string; icon: string; tourSelector?: string; }
export interface NavGroupItem { id: string; label: string; icon: string; children: NavChildItem[]; }
export type NavEntry = NavChildItem | NavGroupItem;

export type Theme = 'system' | 'light' | 'dark';
export interface UserConfiguration { theme: Theme; dialect: string; hasSeenWalkthrough: boolean; }
export interface WalkthroughStep { id: string; route: Route; targetSelector: string; title: string; body: string; }
export interface ToastMessage { id: string; kind: 'success' | 'error' | 'info' | 'warning'; text: string; }
