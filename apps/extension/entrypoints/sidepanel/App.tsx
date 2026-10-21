import type { Claim, CreateInvestigation, Investigation } from '@polifamia/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ClaimList } from '../../src/components/ClaimList';
import { Coverage } from '../../src/components/Coverage';
import { FeedbackForm } from '../../src/components/FeedbackForm';
import { FailureNotice, InvestigationView, type LocalClaim } from '../../src/components/InvestigationView';
import { ManualClaim } from '../../src/components/ManualClaim';
import { Button, DemoBadge, Notice, ViewHeading } from '../../src/components/ui';
import { videoState } from '../../src/hooks/usePanelState';
import { API_HOST, api } from '../../src/lib/api-client';
import { seek, useActiveVideo, usePageSelection, type ActiveVideo } from '../../src/lib/chrome-bridge';
import type { PageSelection } from '../../src/lib/selection';

let panelOpenedSent = false;

export function App() {
  const active = useActiveVideo();
  const { selection, clear } = usePageSelection(active?.tabId ?? null);
  const [coverage, setCoverage] = useState(false);
  useEffect(() => {
    if (panelOpenedSent) return;
    panelOpenedSent = true;
    api.event({ name: 'panel_opened' });
  }, []);

  return (
    <div className="space-y-3 p-3">
      <header className="space-y-1 border-b border-line pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Polifamia</h1>
          {/* window.close() en un side panel lo cierra; el icono de la extensión lo vuelve a abrir. */}
          <button
            type="button"
            onClick={() => window.close()}
            aria-label="Cerrar panel"
            title="Cerrar panel (se reabre con el icono de la extensión)"
            className="rounded px-2 text-lg leading-none text-muted hover:text-current focus-visible:outline focus-visible:outline-2"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-muted">
          Qué se ha afirmado, qué fuentes hay y qué queda sin probar. Solo se envía a {API_HOST} lo que
          decidas investigar y, en YouTube, el identificador del vídeo.{' '}
          {!coverage && (
            <Button variant="link" onClick={() => setCoverage(true)}>
              Cobertura y límites
            </Button>
          )}
        </p>
      </header>
      <main aria-live="polite">
        {coverage && <Coverage onBack={() => setCoverage(false)} />}
        {/* Oculto, no desmontado: abrir «Cobertura» no pierde una investigación en curso. */}
        <div hidden={coverage}>
          {active ? (
            // `key` reinicia todo el estado al cambiar de pestaña, de vídeo o de selección: nunca se mezclan
            // datos ni llega tarde el resultado de una selección anterior.
            <VideoPanel
              key={`${active.tabId}:${active.videoId}:${selection?.at ?? ''}`}
              video={active}
              selection={selection}
              onSelectionDone={clear}
            />
          ) : (
            <p className="text-muted">Conectando con la pestaña…</p>
          )}
        </div>
      </main>
    </div>
  );
}

type View =
  | { kind: 'list' }
  | { kind: 'manual' }
  | { kind: 'selection' }
  | { kind: 'unsupported_page' }
  | { kind: 'investigation'; id: string; local?: LocalClaim }
  | { kind: 'feedback'; investigation: Investigation; local?: LocalClaim };

type Props = { video: ActiveVideo; selection: PageSelection | null; onSelectionDone: () => void };

function VideoPanel({ video, selection, onSelectionDone }: Props) {
  const { tabId, videoId } = video;
  const page = selection && !('unsupported' in selection) ? selection : null;
  const [view, setView] = useState<View>(() =>
    page ? { kind: 'selection' } : selection ? { kind: 'unsupported_page' } : { kind: 'list' },
  );
  const [seekFailed, setSeekFailed] = useState(false);

  const availability = useQuery({
    queryKey: ['availability', videoId],
    queryFn: () => api.availability(videoId!),
    enabled: !!videoId,
  });
  const claims = useQuery({
    queryKey: ['claims', videoId],
    queryFn: () => api.claims(videoId!),
    enabled: availability.data?.status === 'claims_ready',
  });
  const state = videoState(videoId, availability, claims);

  const investigate = useMutation({
    mutationFn: (body: CreateInvestigation) => api.createInvestigation(body),
    // Reintento único ante fallo de red con la misma idempotencyKey: nunca duplica la investigación.
    retry: (n, err) => n < 1 && (err as { code?: string }).code === 'network',
  });
  /** `local`: texto libre (pegado o seleccionado), que se muestra tal cual y nunca con minuto. */
  const start = (body: { claimId: string } | { manualClaim: string }, local?: LocalClaim) => {
    api.event({ name: 'investigation_requested', videoId: videoId ?? undefined });
    const origin = local?.domain ? { origin: 'web_selection' as const } : {};
    investigate.mutate(
      { ...body, ...origin, idempotencyKey: crypto.randomUUID() },
      {
        onSuccess: (inv) => {
          if (local?.domain) api.event({ name: 'selection_investigated', investigationId: inv.id });
          setView({ kind: 'investigation', id: inv.id, local });
        },
      },
    );
  };
  const startText = (text: string, domain?: string) => start({ manualClaim: text }, { text, domain });
  const cancel = () => {
    onSelectionDone();
    setView({ kind: 'list' });
  };

  const seekTo = async (startMs: number) => {
    if (videoId) setSeekFailed(!(await seek(tabId, videoId, startMs / 1000)));
  };

  if (investigate.isPending)
    return (
      <Notice title="Investigando…">
        <span aria-busy="true">Enviando la petición…</span>
      </Notice>
    );
  if (investigate.isError)
    return (
      <FailureNotice
        state={(investigate.error as { code?: string }).code ?? 'error'}
        action={
          <Button variant="link" onClick={() => investigate.reset()}>
            ← Volver
          </Button>
        }
      />
    );

  if (view.kind === 'investigation')
    return (
      <InvestigationView
        id={view.id}
        local={view.local}
        onBack={() => setView({ kind: 'list' })}
        onSeek={(ms) => void seekTo(ms)}
        onFeedback={(inv) => setView({ kind: 'feedback', investigation: inv, local: view.local })}
        onReinvestigate={(inv) =>
          view.local
            ? startText(view.local.text, view.local.domain)
            : start(
                inv.claim.kind === 'video' ? { claimId: inv.claim.claimId } : { manualClaim: inv.claim.text },
              )
        }
      />
    );
  if (view.kind === 'feedback')
    return (
      <FeedbackForm
        investigation={view.investigation}
        onDone={() => setView({ kind: 'investigation', id: view.investigation.id, local: view.local })}
      />
    );
  if (view.kind === 'manual')
    return (
      <ManualClaim
        busy={investigate.isPending}
        onSubmit={(text) => startText(text)}
        onCancel={() => setView({ kind: 'list' })}
      />
    );
  if (view.kind === 'selection' && page)
    return (
      <ManualClaim
        key={page.at}
        page={page}
        busy={investigate.isPending}
        onSubmit={(text) => {
          onSelectionDone();
          startText(text, page.domain);
        }}
        onCancel={cancel}
      />
    );

  const refetch = () => void (claims.error ? claims.refetch() : availability.refetch());
  const manualButton = (
    <Button variant="secondary" onClick={() => setView({ kind: 'manual' })}>
      Pegar una afirmación
    </Button>
  );
  const retry = (
    <Button variant="secondary" onClick={refetch}>
      Reintentar
    </Button>
  );

  if (view.kind === 'unsupported_page')
    return (
      <Notice title="Esta página no es compatible" action={manualButton}>
        No se puede investigar texto de PDFs, páginas internas del navegador ni ficheros locales. Puedes pegar
        la afirmación para investigarla.
      </Notice>
    );

  switch (state) {
    case 'idle':
      return (
        <Notice title="Selecciona una frase y elige «Investigar esta afirmación»" action={manualButton}>
          En cualquier noticia, selecciona una frase con un dato, haz clic derecho y elige «Investigar esta
          afirmación». En los vídeos de YouTube del catálogo, el panel muestra sus afirmaciones. También
          puedes pegar una afirmación.
        </Notice>
      );
    case 'loading':
      return <p className="text-muted">Comprobando el vídeo…</p>;
    case 'unsupported_video':
      return (
        <Notice title="Vídeo todavía no compatible" action={manualButton}>
          Solo analizamos vídeos cuya transcripción tenemos permiso para usar. Puedes pegar una afirmación
          para investigarla por separado.
        </Notice>
      );
    case 'transcript_unavailable':
      return (
        <Notice title="Transcripción no disponible" action={manualButton}>
          Este vídeo está en el catálogo, pero su transcripción autorizada aún no está disponible.
        </Notice>
      );
    case 'preparing_claims':
      return (
        <Notice title="Preparando afirmaciones" action={retry}>
          Estamos seleccionando las afirmaciones verificables de este vídeo. Vuelve a intentarlo en unos
          minutos.
        </Notice>
      );
    case 'claims_ready':
      return (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ViewHeading>Análisis disponible</ViewHeading>
            {availability.data?.isDemo && <DemoBadge />}
          </div>
          {availability.data?.isDemo && (
            <p className="text-xs text-demo">
              Vídeo y afirmaciones de demostración, no corresponden a un discurso real.
            </p>
          )}
          {seekFailed && (
            <p role="alert" className="text-xs text-demo">
              No se ha podido mover el vídeo. Recarga la pestaña de YouTube y vuelve a intentarlo.
            </p>
          )}
          <ClaimList
            claims={claims.data!.claims}
            currentMs={video.currentTime * 1000}
            onSeek={(c: Claim) => void seekTo(c.startMs)}
            onInvestigate={(c: Claim) => start({ claimId: c.id })}
          />
          <p className="text-xs text-muted">
            Al investigar se envía al servidor solo el identificador de la afirmación.
          </p>
          <div className="border-t border-line pt-2">{manualButton}</div>
        </section>
      );
    default:
      return <FailureNotice state={state} onRetry={refetch} />;
  }
}
