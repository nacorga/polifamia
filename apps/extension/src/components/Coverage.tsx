import { API_HOST } from '../lib/api-client';
import { Button, ViewHeading } from './ui';

/** Qué cubre y qué no cubre el MVP (FR-009, PRD §5 Flujo B): mismo texto para cualquier vídeo u orador. */
export function Coverage({ onBack }: { onBack: () => void }) {
  return (
    <section className="space-y-3" aria-label="Cobertura y límites">
      <Button variant="link" onClick={onBack}>
        ← Volver
      </Button>
      <ViewHeading>Cobertura y límites</ViewHeading>
      <div className="space-y-1">
        <h3 className="font-semibold">Vídeos</h3>
        <p>
          Solo analizamos vídeos de un catálogo cuya transcripción tenemos permiso para usar. No leemos
          subtítulos de YouTube ni otras páginas. En cualquier vídeo puedes pegar una afirmación suelta.
        </p>
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">Fuentes consultadas</h3>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>Estadísticas oficiales del INE: tasa de paro (EPA), IPC y PIB trimestral.</li>
          <li>Documentos institucionales del corpus autorizado (p. ej., BOE).</li>
          <li>Verificaciones ya publicadas (Google Fact Check Tools), como contexto, no como veredicto.</li>
        </ul>
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">Qué no hacemos</h3>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>No evaluamos opiniones ni predicciones.</li>
          <li>No puntuamos a políticos ni a partidos ni deducimos intenciones.</li>
          <li>
            Si no encontramos evidencia suficiente lo decimos; eso no significa que la afirmación sea falsa.
          </li>
          <li>Las conclusiones solo se apoyan en fuentes originales localizadas y enlazadas.</li>
        </ul>
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">Privacidad</h3>
        <p>
          Solo se envía a {API_HOST} el identificador del vídeo, la afirmación que decidas investigar y un
          identificador anónimo de instalación para limitar el uso. No hay cuentas ni seguimiento de tu
          navegación.
        </p>
      </div>
    </section>
  );
}
