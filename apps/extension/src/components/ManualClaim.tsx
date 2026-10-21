import { MANUAL_CLAIM_MAX, MANUAL_CLAIM_MIN } from '@polifamia/contracts';
import { useId, useState } from 'react';
import { API_HOST } from '../lib/api-client';
import { Button, ViewHeading } from './ui';

type Props = { busy: boolean; onSubmit: (text: string) => void; onCancel: () => void };

export function ManualClaim({ busy, onSubmit, onCancel }: Props) {
  const [text, setText] = useState('');
  const id = useId();
  const length = text.trim().length;
  const valid = length >= MANUAL_CLAIM_MIN && length <= MANUAL_CLAIM_MAX;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(text.trim());
      }}
    >
      <ViewHeading>Pegar una afirmación</ViewHeading>
      <label htmlFor={id} className="block text-muted">
        Escribe o pega la frase que quieres investigar.
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={MANUAL_CLAIM_MAX + 50}
        aria-describedby={`${id}-help ${id}-privacy`}
        className="w-full rounded border border-line bg-paper p-2"
      />
      <p id={`${id}-help`} className="text-xs text-muted" aria-live="polite">
        {length}/{MANUAL_CLAIM_MAX} caracteres
        {length > 0 && length < MANUAL_CLAIM_MIN && ` · mínimo ${MANUAL_CLAIM_MIN}`}
        {length > MANUAL_CLAIM_MAX && ' · demasiado largo'}
      </p>
      <p id={`${id}-privacy`} className="rounded bg-wash p-2 text-xs">
        Se enviará solo este texto a <strong>{API_HOST}</strong> para buscar verificaciones y fuentes
        oficiales. Se tratará como texto aportado por ti: no se asociará a ningún minuto del vídeo.
      </p>
      <div className="flex gap-3">
        <Button type="submit" disabled={!valid || busy}>
          {busy ? 'Enviando…' : 'Investigar'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
