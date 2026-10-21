import { browser, defineContentScript } from '#imports';
import { ExtensionMessage, YoutubeId, type ContentMessage, type SeekResult } from '@polifamia/contracts';

/**
 * Lee solo el `videoId` de la URL y el estado del <video> principal; ejecuta `seek` bajo petición.
 * No lee subtítulos ni otro contenido del DOM, no pausa y no dibuja nada sobre la página.
 */
function currentVideoId(): string | null {
  if (location.pathname !== '/watch') return null;
  const v = new URLSearchParams(location.search).get('v');
  return v && YoutubeId.safeParse(v).success ? v : null;
}

function player(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>('#movie_player video') ?? document.querySelector('video');
}

function state() {
  const v = player();
  return {
    type: 'video:state' as const,
    videoId: currentVideoId(),
    currentTime: v?.currentTime ?? 0,
    paused: v?.paused ?? true,
  };
}

// Sin panel abierto no hay receptor: el mensaje se descarta y nada sale del navegador.
const send = (msg: ContentMessage) => browser.runtime.sendMessage(msg).catch(() => undefined);

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  main(ctx) {
    let lastId = currentVideoId();
    let lastTick = 0;

    const onNavigate = () => {
      const id = currentVideoId();
      if (id === lastId) return;
      lastId = id;
      void send({ type: 'video:navigated', videoId: id });
    };
    ctx.addEventListener(window, 'wxt:locationchange', onNavigate);
    ctx.addEventListener(document, 'yt-navigate-finish' as keyof DocumentEventMap, onNavigate);

    // Los eventos de <video> no burbujean: se capturan en document para sobrevivir al reemplazo del elemento.
    const onMedia = (e: Event) => {
      if (e.target !== player() || !currentVideoId()) return;
      if (e.type === 'timeupdate') {
        if (performance.now() - lastTick < 1000) return;
        lastTick = performance.now();
      }
      void send(state());
    };
    for (const type of ['play', 'pause', 'seeked', 'timeupdate'] as const)
      ctx.addEventListener(document, type, onMedia, { capture: true });

    const onMessage = (raw: unknown, _sender: unknown, respond: (r: unknown) => void) => {
      const msg = ExtensionMessage.safeParse(raw);
      if (!msg.success) return false;
      if (msg.data.type === 'video:getState') {
        respond({ ...state(), requestId: msg.data.requestId });
        return false;
      }
      if (msg.data.type === 'video:seek') {
        const v = player();
        const ok = !!v && msg.data.videoId === currentVideoId();
        if (ok) v.currentTime = msg.data.seconds;
        respond({ requestId: msg.data.requestId, ok, currentTime: v?.currentTime ?? 0 } satisfies SeekResult);
      }
      return false;
    };
    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(onMessage));
  },
});
