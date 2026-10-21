# Polifamia

Spec-driven (github/spec-kit). Antes de cambiar código lee:

- `.specify/memory/constitution.md` — principios no negociables.
- `specs/001-youtube-claim-investigation/` — spec, plan, research, data-model, contracts, tasks.
- `specs/002-web-claim-investigation/` — ampliación a artículos por selección (spec; plan y tasks pendientes).
- `prd.md` — PRD de producto (fuente original).

Reglas de trabajo:

- `tasks.md` es el estado compartido: marca `[x]` al completar cada tarea.
- Checks antes de declarar algo hecho: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Datos simulados siempre etiquetados DEMO. Nunca scraping de YouTube. Nunca secretos en la extensión.
- Gates humanos (legal D0, dataset revisado, auditoría G3, V1–V3) se documentan en `docs/gates.md`, no se dan por cerrados.
