import { describe, expect, it } from 'vitest';
import { selectionFromClick, selectionKey } from './selection';

const now = new Date('2026-10-21T10:00:00Z');

describe('selectionFromClick', () => {
  it('keeps only origin and path of the page and normalizes the text (SC-006)', () => {
    expect(
      selectionFromClick(
        {
          selectionText: '  La inflación\n interanual cerró 2023 en el 3,1 %.  ',
          pageUrl: 'https://www.diario.example/2026/10/articulo?utm_source=x&session=abc#p3',
        },
        { title: 'Artículo DEMO' },
        now,
      ),
    ).toEqual({
      text: 'La inflación interanual cerró 2023 en el 3,1 %.',
      url: 'https://www.diario.example/2026/10/articulo',
      domain: 'diario.example',
      title: 'Artículo DEMO',
      at: now.toISOString(),
    });
  });
  it.each([
    'chrome://newtab/',
    'file:///home/a.html',
    'https://x.example/informe.PDF',
    'not a url',
    undefined,
  ])('marks %s as unsupported (FR-014)', (pageUrl) => {
    expect(selectionFromClick({ selectionText: 'El paro bajó un 10 %', pageUrl }, undefined, now)).toEqual({
      unsupported: true,
      at: now.toISOString(),
    });
  });
  it('tolerates a missing title and selection', () => {
    expect(selectionFromClick({ pageUrl: 'http://a.example/' }, undefined, now)).toMatchObject({
      text: '',
      title: '',
      url: 'http://a.example/',
    });
  });
  it('keys the selection by tab', () => {
    expect(selectionKey(7)).toBe('selection:7');
  });
});
