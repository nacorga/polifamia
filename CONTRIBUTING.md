# Contribuir a Polifamia

Gracias por tu interés. Polifamia investiga afirmaciones políticas, así que las reglas sobre evidencia y
neutralidad pesan tanto como el código. Antes de abrir un PR, lee:

- [`.specify/memory/constitution.md`](.specify/memory/constitution.md): principios no negociables.
- [`docs/governance.md`](docs/governance.md): quién decide, cómo se añaden fuentes y cómo se disputa un resultado.
- [`specs/001-youtube-claim-investigation/`](specs/001-youtube-claim-investigation/): spec, plan y tareas del MVP.

## Entorno

Sigue la sección «Desarrollo» del [README](README.md). Necesitas Node ≥22.12, pnpm y Docker. El modo `demo` no
necesita claves de ningún proveedor.

## Flujo de trabajo

1. Abre o comenta una issue antes de cambios grandes.
2. Trabajo spec-driven (github/spec-kit): las funcionalidades nuevas parten de una spec en `specs/NNN-*/`.
   `tasks.md` es el estado compartido: marca `[x]` al completar cada tarea.
3. Cualquier cambio en la política de evidencia, las fuentes aprobadas o los estados de resultado requiere un ADR
   en [`docs/adr/`](docs/adr/).
4. Una rama por cambio, commits pequeños con [Conventional Commits](https://www.conventionalcommits.org/es/)
   (`feat(api): …`, `fix(extension): …`, `docs: …`).
5. Antes de pedir revisión, todo en verde:

   ```bash
   pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
   pnpm e2e   # si tocas la extensión
   ```

## Reglas que un PR no puede saltarse

- **Evidencia antes que veredicto**: la conclusión la decide código determinista, nunca el LLM
  ([ADR 0002](docs/adr/0002-politica-de-evidencia.md)).
- **Neutralidad**: nada puede depender del orador, del partido o de la identidad política. Los tests de invariancia
  lo comprueban.
- **Sin scraping de YouTube**: ni subtítulos, ni endpoints internos, ni descargas.
- **Sin secretos en la extensión**: `apps/extension/scripts/check-bundle.mjs` hace fallar el build si los hay.
- **Datos simulados siempre etiquetados DEMO.**
- **Los gates humanos** (legal, revisión del dataset, auditoría de evidencias, validación con usuarios) se documentan en
  [`docs/gates.md`](docs/gates.md). Un PR no los da por cerrados.

## Licencia de las contribuciones

Al contribuir aceptas que tu código se publique bajo [AGPL-3.0-or-later](LICENSE) y tus datos bajo las licencias de
[`DATA-LICENSE.md`](DATA-LICENSE.md). No hay CLA.

## Seguridad y conducta

Las vulnerabilidades se reportan en privado, nunca en issues: ver [`SECURITY.md`](SECURITY.md). Este proyecto sigue un
[Código de Conducta](CODE_OF_CONDUCT.md).
