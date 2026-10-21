import type { Claim } from '@polifamia/contracts';
import { formatTime } from '../lib/format';
import { Button, DemoBadge } from './ui';

type Props = {
  claims: Claim[];
  currentMs: number;
  onSeek: (claim: Claim) => void;
  onInvestigate: (claim: Claim) => void;
};

export function ClaimList({ claims, currentMs, onSeek, onInvestigate }: Props) {
  const checkable = claims.filter((c) => c.checkability === 'CHECKABLE');
  const other = claims.filter((c) => c.checkability === 'NOT_CHECKABLE');
  if (!checkable.length)
    return <p className="text-muted">No hemos seleccionado afirmaciones verificables en este vídeo.</p>;
  return (
    <div className="space-y-3">
      <ol className="space-y-2" aria-label="Afirmaciones verificables">
        {checkable.map((c) => (
          <ClaimItem
            key={c.id}
            claim={c}
            current={currentMs >= c.startMs && currentMs < c.endMs}
            onSeek={onSeek}
          >
            <Button
              variant="secondary"
              onClick={() => onInvestigate(c)}
              aria-label={`Investigar: ${c.literal}`}
            >
              Investigar
            </Button>
          </ClaimItem>
        ))}
      </ol>
      {other.length > 0 && (
        <details className="text-muted">
          <summary className="cursor-pointer">
            Otras frases ({other.length}): opiniones o predicciones
          </summary>
          <ol className="mt-2 space-y-2">
            {other.map((c) => (
              <ClaimItem key={c.id} claim={c} current={false} onSeek={onSeek}>
                <span className="text-xs">No verificable como hecho</span>
              </ClaimItem>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

type ItemProps = {
  claim: Claim;
  current: boolean;
  onSeek: (claim: Claim) => void;
  children: React.ReactNode;
};

function ClaimItem({ claim, current, onSeek, children }: ItemProps) {
  return (
    <li
      aria-current={current || undefined}
      className={`space-y-1.5 rounded border p-2.5 ${current ? 'border-accent' : 'border-line'}`}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="link"
          onClick={() => onSeek(claim)}
          aria-label={`Ir al minuto ${formatTime(claim.startMs)}`}
        >
          {formatTime(claim.startMs)}
        </Button>
        {claim.isDemo && <DemoBadge />}
      </div>
      <blockquote className="leading-snug">«{claim.literal}»</blockquote>
      {claim.declaredSource && (
        <p className="text-xs text-muted">Fuente citada por el orador: {claim.declaredSource}</p>
      )}
      {children}
    </li>
  );
}
