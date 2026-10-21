# Governance and neutrality

Polifamia shows what was claimed, which sources exist and what they prove. Being auditable is part of the product:
this document explains who decides and by which criteria.

## Who decides

The project is maintained by [@nacorga](https://github.com/nacorga), who decides merges, new sources and amendments to
the [constitution](../.specify/memory/constitution.md). Decisions that change how investigations behave are recorded
as ADRs in [`docs/adr/`](adr/) so the reasoning stays public.

## Criteria for adding a source

A source can only support `SUPPORTED`/`CONTRADICTED` if it meets all of these:

1. **Primary and institutional**: it publishes the original data (INE, BOE, AIReF…), not a media summary.
2. **Reusable**: it has documented reuse terms, which are added to [`DATA-LICENSE.md`](../DATA-LICENSE.md).
3. **Deterministic**: a connector queries an exact locator (series, period, article) through `safe-fetch` with the
   host on the allowlist, never an open search.
4. **Tested**: a real response recorded as a fixture, plus connector tests.

Where it is registered: INE series in `packages/connectors/src/ine/registry.ts` and institutional documents in
`corpus/documents/` (`pnpm --filter @polifamia/connectors record:fixtures`). Any other origin needs an ADR.
Third-party fact-checks (Fact Check Tools) count as context, never as certification
([ADR 0002](adr/0002-politica-de-evidencia.md)).

To propose a source, use the ["Propose a source"](https://github.com/nacorga/polifamia/issues/new?template=propose-source.yml)
template.

## Disputing a result

- From the extension, with "Hay un problema con esta investigación" ("There is a problem with this investigation").
- On GitHub, with the ["Incorrect result"](https://github.com/nacorga/polifamia/issues/new?template=incorrect-result.yml)
  template, stating the claim, the cited evidence and what is wrong.

If the error comes from data, code or policy, it is fixed and a **new version** of the investigation is generated.
Previous versions are not deleted: they are marked as superseded. A disagreement without new evidence does not change
a result.

## Never accepted

- Logic that depends on the speaker, party or political identity, or rankings and scores of politicians.
- The LLM deciding the conclusion or introducing URLs, citations or figures that are not in the retrieved evidence.
- YouTube scraping or content without documented rights.
- Simulated data without the DEMO label.
- Funding or partnerships that influence what is investigated or how it is presented. Any funding or partnership will
  be declared in this document.
