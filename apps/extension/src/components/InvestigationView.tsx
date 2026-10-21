import type { Conclusion, Evidence, Investigation } from '@polifamia/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { investigationState, pollInterval } from '../hooks/usePanelState';
import { api } from '../lib/api-client';
import { formatDate, formatTime } from '../lib/format';
import { Button, DemoBadge, Notice, ViewHeading } from './ui';

const CONCLUSION: Record<Conclusion, { title: string; note?: string }> = {
  SUPPORTED: { title: 'Las evidencias localizadas respaldan la afirmación' },
  CONTRADICTED: { title: 'Las evidencias localizadas no coinciden con la afirmación' },
  NEEDS_CONTEXT: { title: 'La afirmación necesita contexto' },
  INSUFFICIENT_EVIDENCE: {
    title: 'No hemos encontrado evidencia suficiente',
    note: 'Esto no significa que la afirmación sea falsa: solo que no hemos podido comprobarla con las fuentes disponibles.',
  },
};

const PROVENANCE: Record<Evidence['provenance'], string> = {
  declared_source: 'Fuente citada por el orador',
  retrieved_evidence: 'Fuente localizada por el sistema',
  unknown_origin: 'Origen desconocido',
};

const KIND: Record<Evidence['source']['kind'], string> = {
  primary: 'Fuente original',
  secondary: 'Fuente secundaria',
  factcheck: 'Verificación publicada',
};

/** Afirmación tal como la aportó la persona (pegada o seleccionada); se muestra en vez de la del servidor. */
export type LocalClaim = { text: string; domain?: string };

type Props = {
  id: string;
  local?: LocalClaim;
  onBack: () => void;
  onSeek: (startMs: number) => void;
  onFeedback: (inv: Investigation) => void;
  onReinvestigate: (inv: Investigation) => void;
};

export function InvestigationView({ id, local, onBack, onSeek, onFeedback, onReinvestigate }: Props) {
  const query = useQuery({
    queryKey: ['investigation', id],
    queryFn: () => api.investigation(id),
    refetchInterval: (q) => pollInterval(q.state.data, q.state.dataUpdateCount),
  });
  const state = investigationState(query);
  const inv = query.data;

  const reported = useRef(false);
  useEffect(() => {
    if (!reported.current && (state === 'investigation_ready' || state === 'insufficient_evidence')) {
      reported.current = true;
      api.event({ name: 'result_opened', investigationId: id });
    }
  }, [state, id]);

  const back = (
    <Button variant="link" onClick={onBack}>
      ← Volver a la lista
    </Button>
  );

  if (state === 'investigation_pending')
    return (
      <Notice
        title="Investigando…"
        action={
          <Button variant="secondary" onClick={onBack}>
            Dejar de esperar
          </Button>
        }
      >
        <span aria-busy="true">
          Buscando verificaciones existentes y fuentes oficiales. Puede tardar hasta un minuto; el vídeo sigue
          reproduciéndose.
        </span>
      </Notice>
    );
  if (!inv || (state !== 'investigation_ready' && state !== 'insufficient_evidence'))
    return (
      <FailureNotice
        state={inv?.failureReason ?? state}
        action={back}
        // Un job FAILED es definitivo: reintentar crea una investigación nueva; si no, se vuelve a consultar.
        // Lo no verificable no se reintenta: el resultado sería el mismo.
        onRetry={
          inv?.failureReason === 'not_checkable'
            ? undefined
            : inv?.status === 'FAILED'
              ? () => onReinvestigate(inv)
              : () => void query.refetch()
        }
      />
    );

  const conclusion = CONCLUSION[inv.conclusion ?? 'INSUFFICIENT_EVIDENCE'];
  const expired = inv.expiresAt !== null && new Date(inv.expiresAt) < new Date();

  return (
    <article className="space-y-4" aria-label="Resultado de la investigación">
      {back}
      {inv.isDemo && (
        <p className="rounded bg-demo-wash p-2 text-demo">
          <strong>DEMO</strong> — resultado simulado para probar la experiencia. No es una verificación real.
        </p>
      )}

      <section className="space-y-1">
        <ViewHeading>Afirmación</ViewHeading>
        <blockquote className="leading-snug">
          «{local?.text ?? (inv.claim.kind === 'video' ? inv.claim.literal : inv.claim.text)}»
        </blockquote>
        {/* Texto libre: aunque coincida con una afirmación de vídeo del catálogo, aquí no hay minuto. */}
        {local?.domain ? (
          <p className="text-xs text-muted">
            Texto seleccionado por ti en {local.domain}; no procede de una transcripción ni tiene minuto.
          </p>
        ) : !local && inv.claim.kind === 'video' ? (
          <Button variant="link" onClick={() => inv.claim.kind === 'video' && onSeek(inv.claim.startMs)}>
            Volver al minuto {formatTime(inv.claim.startMs)}
          </Button>
        ) : (
          <p className="text-xs text-muted">
            Texto aportado por ti; no procede de una transcripción ni tiene minuto.
          </p>
        )}
      </section>

      <section className="space-y-1">
        <h3 className="font-semibold">Qué muestran las evidencias</h3>
        <p className="font-medium">{conclusion.title}</p>
        {conclusion.note && <p className="text-muted">{conclusion.note}</p>}
        {inv.summary && <p>{inv.summary}</p>}
      </section>

      {(inv.context || inv.limitations || inv.stats) && (
        <section className="space-y-1">
          <h3 className="font-semibold">Contexto y limitaciones</h3>
          {inv.context && <p>{inv.context}</p>}
          {inv.stats && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
              <dt className="text-muted">Indicador</dt>
              <dd>{inv.stats.indicator}</dd>
              <dt className="text-muted">Unidad</dt>
              <dd>{inv.stats.unit}</dd>
              <dt className="text-muted">Ámbito</dt>
              <dd>{inv.stats.territory}</dd>
              <dt className="text-muted">Periodo</dt>
              <dd>{inv.stats.period}</dd>
              {inv.stats.comparisonBase && (
                <>
                  <dt className="text-muted">Comparación</dt>
                  <dd>{inv.stats.comparisonBase}</dd>
                </>
              )}
              {inv.stats.formula && (
                <>
                  <dt className="text-muted">Cálculo</dt>
                  <dd>
                    {inv.stats.formula}
                    {inv.stats.result && ` = ${inv.stats.result}`}
                  </dd>
                </>
              )}
            </dl>
          )}
          {inv.limitations && <p className="text-muted">{inv.limitations}</p>}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="font-semibold">Fuentes ({inv.evidence.length})</h3>
        {inv.evidence.length === 0 && (
          <p className="text-muted">No se ha localizado ninguna fuente pertinente.</p>
        )}
        <ul className="space-y-2">
          {inv.evidence.map((e) => (
            <EvidenceItem key={e.id} evidence={e} investigationId={inv.id} isDemo={inv.isDemo} />
          ))}
        </ul>
      </section>

      <footer className="space-y-2 border-t border-line pt-3 text-xs text-muted">
        {inv.checkedAt && (
          <p>
            Comprobado el {formatDate(inv.checkedAt)} · versión {inv.version}
          </p>
        )}
        {expired ? (
          <p className="text-demo">
            Este resultado ha caducado y puede estar desactualizado.{' '}
            <Button variant="link" onClick={() => onReinvestigate(inv)}>
              Investigar de nuevo
            </Button>
          </p>
        ) : (
          inv.expiresAt && <p>Se revisará antes del {formatDate(inv.expiresAt)}</p>
        )}
        <Button variant="link" onClick={() => onFeedback(inv)}>
          Hay un problema con esta investigación
        </Button>
      </footer>
    </article>
  );
}

function EvidenceItem({
  evidence: e,
  investigationId,
  isDemo,
}: {
  evidence: Evidence;
  investigationId: string;
  isDemo: boolean;
}) {
  return (
    <li className="space-y-1 rounded border border-line p-2.5">
      <a
        href={e.source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-accent underline-offset-2 hover:underline"
        onClick={() => api.event({ name: 'source_clicked', investigationId })}
      >
        {e.source.title}
      </a>
      <p className="text-xs text-muted">
        {e.source.publisher}
        {e.source.publishedAt && ` · publicado ${formatDate(e.source.publishedAt)}`}
        {e.dataDate && ` · dato de ${e.dataDate}`}
        {` · consultado el ${formatDate(e.accessedAt)}`}
      </p>
      <p className="flex flex-wrap gap-1 text-[11px]">
        <span className="rounded bg-wash px-1.5 py-0.5">{PROVENANCE[e.provenance]}</span>
        <span className="rounded bg-wash px-1.5 py-0.5">{KIND[e.source.kind]}</span>
        {isDemo && <DemoBadge />}
      </p>
      <blockquote className="border-l-2 border-line pl-2 leading-snug">{e.excerpt}</blockquote>
      <p className="text-xs text-muted">Localización: {e.locator}</p>
      {e.checkStatus === 'link_failed' && (
        <p className="text-xs text-demo">El enlace no respondía al comprobarlo.</p>
      )}
    </li>
  );
}

/**
 * Copy por estado UX o motivo de fallo (FR-009): cada causa se explica por separado y siempre deja
 * claro que no se ha generado ninguna conclusión.
 */
const FAILURE_COPY: Record<string, [string, string]> = {
  rate_limited: ['Límite de uso alcanzado', 'Espera unos minutos y vuelve a intentarlo.'],
  budget_exceeded: [
    'Límite diario de investigaciones alcanzado',
    'Para controlar el coste, hoy no se inician investigaciones nuevas. Los resultados ya comprobados siguen disponibles.',
  ],
  source_unavailable: [
    'Una fuente no está disponible ahora mismo',
    'La investigación no se ha completado. No mostramos conclusiones sin fuentes; inténtalo más tarde.',
  ],
  no_llm_key: [
    'Investigación automática no disponible',
    'El servidor no tiene activado el motor de investigación. No se ha generado ningún resultado.',
  ],
  provider_error: [
    'El servicio de análisis ha fallado',
    'La investigación se ha detenido sin conclusión. Puedes reintentarlo en unos minutos.',
  ],
  timeout: [
    'La investigación ha tardado demasiado',
    'Se ha detenido al superar el tiempo máximo, sin conclusión. Puedes reintentarlo.',
  ],
  not_checkable: [
    'No es una afirmación verificable',
    'Parece una opinión o una predicción, así que no se investiga como un hecho. Prueba con un dato concreto, por ejemplo una cifra con su periodo.',
  ],
};

export function FailureNotice({
  state,
  action,
  onRetry,
}: {
  state: string;
  action?: React.ReactNode;
  onRetry?: () => void;
}) {
  const retry = onRetry && (
    <Button variant="secondary" onClick={onRetry}>
      Reintentar
    </Button>
  );
  const body = FAILURE_COPY[state] ?? [
    'No se ha podido completar',
    'Ha ocurrido un error de conexión o del servidor. No se ha generado ningún resultado.',
  ];
  return (
    <Notice
      title={body[0]!}
      action={
        <div className="flex gap-3">
          {retry}
          {action}
        </div>
      }
    >
      {body[1]}
    </Notice>
  );
}
