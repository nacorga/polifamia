import { browser, defineBackground } from '#imports';

const isYoutube = (url?: string) => !!url && /^https:\/\/(www\.|m\.)?youtube\.com\//.test(url);

/** El panel solo existe en pestañas de YouTube; en el resto queda deshabilitado (FR-012). */
function syncPanel(tabId: number, url?: string) {
  void browser.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: isYoutube(url) });
}

export default defineBackground(() => {
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.url || info.status === 'complete') syncPanel(tabId, tab.url);
  });
  browser.runtime.onInstalled.addListener(async () => {
    for (const tab of await browser.tabs.query({})) if (tab.id !== undefined) syncPanel(tab.id, tab.url);
  });
});
