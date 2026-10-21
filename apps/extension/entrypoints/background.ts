import { browser, defineBackground } from '#imports';
import { selectionFromClick, selectionKey } from '../src/lib/selection';

const MENU_ID = 'investigate-selection';

export default defineBackground(() => {
  // El panel existe en cualquier pestaña, pero solo se abre por el icono o el menú (FR-002, FR-013).
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: 'Investigar esta afirmación',
      contexts: ['selection'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    });
  });
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID || tab?.id === undefined) return;
    // Antes de cualquier await: `sidePanel.open` solo funciona dentro del gesto del usuario.
    void browser.sidePanel.open({ tabId: tab.id });
    // `storage.session` vive en memoria: el panel la lee aunque aún no estuviera abierto.
    void browser.storage.session.set({ [selectionKey(tab.id)]: selectionFromClick(info, tab) });
  });
  browser.tabs.onRemoved.addListener((tabId) => void browser.storage.session.remove(selectionKey(tabId)));
});
