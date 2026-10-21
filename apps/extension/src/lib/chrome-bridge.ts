import { browser } from '#imports';
import { ContentMessage, SeekResult, YoutubeId, type VideoState } from '@polifamia/contracts';
import { useEffect, useRef, useState } from 'react';

export type ActiveVideo = Omit<VideoState, 'type'>;

/** `?tabId=` fija la pestaña (tests E2E); si no, se sigue la pestaña activa de la ventana del panel. */
const fixedTabId = Number(new URLSearchParams(location.search).get('tabId')) || null;

function videoIdFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const v = u.pathname === '/watch' ? u.searchParams.get('v') : null;
    return v && YoutubeId.safeParse(v).success ? v : null;
  } catch {
    return null;
  }
}

async function boundTab() {
  if (fixedTabId) return browser.tabs.get(fixedTabId);
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Vídeo de la pestaña vinculada. Cada respuesta se valida contra la pestaña vigente para no mezclar
 * datos tras un cambio de pestaña o de vídeo.
 */
export function useActiveVideo(): ActiveVideo | null {
  const [video, setVideo] = useState<ActiveVideo | null>(null);
  const tabRef = useRef<number | null>(null);

  useEffect(() => {
    const refresh = async () => {
      const tab = await boundTab();
      if (tab?.id === undefined) return;
      const tabId = tab.id;
      tabRef.current = tabId;
      const fallback = { tabId, videoId: videoIdFromUrl(tab.url), currentTime: 0, paused: true };
      const reply = await browser.tabs
        .sendMessage(tabId, { type: 'video:getState', requestId: crypto.randomUUID() })
        .catch(() => null); // sin content script (pestaña previa a la instalación): solo URL
      if (tabRef.current !== tabId) return;
      const parsed = ContentMessage.safeParse(reply);
      setVideo(parsed.success && parsed.data.type === 'video:state' ? { ...parsed.data, tabId } : fallback);
    };

    const onMessage = (raw: unknown, sender: { tab?: { id?: number } }) => {
      const msg = ContentMessage.safeParse(raw);
      if (!msg.success || sender.tab?.id !== tabRef.current) return;
      const tabId = sender.tab.id;
      setVideo((prev) =>
        msg.data.type === 'video:state'
          ? { ...msg.data, tabId }
          : { tabId, videoId: msg.data.videoId, currentTime: 0, paused: prev?.paused ?? true },
      );
    };
    const onActivated = () => {
      if (!fixedTabId) void refresh();
    };
    const onUpdated = (tabId: number, info: { url?: string }) => {
      if (tabId === tabRef.current && info.url) void refresh();
    };

    void refresh();
    browser.runtime.onMessage.addListener(onMessage);
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.runtime.onMessage.removeListener(onMessage);
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return video;
}

/** Desplaza el reproductor; `false` si el vídeo ya no es el mismo o no hay content script. */
export async function seek(tabId: number, videoId: string, seconds: number): Promise<boolean> {
  const requestId = crypto.randomUUID();
  const reply = await browser.tabs
    .sendMessage(tabId, { type: 'video:seek', requestId, videoId, seconds })
    .catch(() => null);
  const parsed = SeekResult.safeParse(reply);
  return parsed.success && parsed.data.requestId === requestId && parsed.data.ok;
}
