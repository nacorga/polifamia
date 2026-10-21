import type { FeedbackReason, Investigation } from '@polifamia/contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api-client';
import { Button, Notice, ViewHeading } from './ui';

const REASONS: Record<FeedbackReason, string> = {
  wrong_source: 'La fuente no respalda lo que se le atribuye',
  wrong_context: 'Falta contexto o el contexto es incorrecto',
  outdated: 'La información está desactualizada',
  misquote: 'La afirmación no está citada fielmente',
  other: 'Otro motivo',
};

export function FeedbackForm({
  investigation,
  onDone,
}: {
  investigation: Investigation;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [comment, setComment] = useState('');
  const send = useMutation({
    mutationFn: () =>
      api.feedback(investigation.id, { reason: reason!, comment: comment.trim() || undefined }),
    onSuccess: () => api.event({ name: 'feedback_sent', investigationId: investigation.id }),
  });

  if (send.isSuccess)
    return (
      <Notice title="Gracias por el reporte" action={<Button onClick={onDone}>Volver al resultado</Button>}>
        Lo revisaremos. La investigación publicada no cambia automáticamente; si hay que corregirla se
        publicará una nueva versión.
      </Notice>
    );

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason) send.mutate();
      }}
    >
      <ViewHeading>Hay un problema con esta investigación</ViewHeading>
      <fieldset className="space-y-1">
        <legend className="mb-1 text-muted">¿Qué ocurre?</legend>
        {(Object.keys(REASONS) as FeedbackReason[]).map((r) => (
          <label key={r} className="flex items-start gap-2">
            <input
              type="radio"
              name="reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
            />
            {REASONS[r]}
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1">
        <span className="text-muted">Comentario (opcional, sin datos personales)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
          className="w-full rounded border border-line bg-paper p-2"
        />
      </label>
      {send.isError && <p role="alert">No se ha podido enviar. Inténtalo de nuevo.</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={!reason || send.isPending}>
          Enviar reporte
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
