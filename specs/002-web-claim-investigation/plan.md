# Implementation Plan: Investigar afirmaciones mientras navegas (artículos y vídeos)

**Branch**: `002-web-claim-investigation` | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-web-claim-investigation/spec.md` + constitución v1.1.0.

## Summary

Se añade una segunda entrada al producto de 001: seleccionar una frase en cualquier página http(s) y elegir
«Investigar esta afirmación» en el menú contextual. El panel lateral (ahora disponible en cualquier pestaña) muestra la
frase, el medio y la dirección sin parámetros, que **no salen del navegador**; al confirmar se envía solo el texto con
la marca `origin: "web_selection"` al mismo `POST /v1/investigations` del texto pegado. El backend resuelve el texto
libre a una afirmación del catálogo cuando su texto normalizado coincide (caché compartida con vídeo y verificabilidad
heredada) y el motor real marca como no verificables las opiniones y predicciones. Sin content script fuera de YouTube,
sin permisos de host nuevos.

## Technical Context

**Language/Version**: TypeScript 5.x estricto; Node ≥22 (sin cambios respecto a 001)

**Primary Dependencies**: las de 001 (WXT, React, TanStack Query; NestJS, Zod, Drizzle, pg-boss). APIs de Chrome nuevas:
`contextMenus`, `activeTab`, `storage.session`, `sidePanel.open`

**Storage**: PostgreSQL 16; una migración (`0001`) con dos valores de enum y una columna nullable

**Testing**: Vitest (unit/integración con PostgreSQL real), Playwright (E2E con la extensión cargada)

**Target Platform**: Chrome escritorio MV3 (≥116, requisito de `sidePanel.open`) + servidor Linux

**Project Type**: monorepo pnpm — extensión + web-service + worker (sin paquetes nuevos)

**Performance Goals**: los de 001; selección → investigación iniciada en ≤2 interacciones (SC-001)

**Constraints**: sin permiso `tabs`, sin host permissions nuevos, sin content scripts fuera de YouTube; medio, dirección
y título nunca se envían; sin secretos en la extensión

**Scale/Scope**: catálogo DEMO (13 afirmaciones); la coincidencia con el catálogo es un recorrido lineal

## Constitution Check

| Principio | Cómo se cumple | Estado |
|---|---|---|
| I Evidencia antes que veredicto | mismo motor, política y validador de citas de 001; la página de origen nunca es evidencia | ✅ diseño |
| II Neutralidad e invariancia | el medio no llega al servicio, así que no puede influir; opiniones/predicciones → `not_checkable` (también corrige el texto pegado de 001 en modo real) | ✅ diseño |
| III Contenido lícito y procedencia | entrada = texto seleccionado marcado `web_selection`; la dirección no se comparte (III: «si el usuario la comparte»); el backend no descarga la página | ✅ diseño (revisión legal humana pendiente) |
| IV Privacidad y seguridad | solo invocación explícita (menú/botón); `activeTab` temporal; permisos `activeTab, contextMenus, sidePanel, storage` comprobados en build; se envía solo el texto | ✅ diseño |
| V Simplicidad | sin paquetes ni tablas nuevas; reutiliza flujo manual, caché y `FailureNotice` | ✅ |

Re-check post-diseño: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/002-web-claim-investigation/
├── spec.md  plan.md  research.md  data-model.md  quickstart.md
├── contracts/api.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/contracts/src/{enums,api}.ts        # origin, not_checkable, selection_investigated
packages/investigation/src/real.ts           # not_checkable desde la clasificación
apps/api/src/db/schema.ts + drizzle/0001_*   # manual_origin, enums
apps/api/src/modules/investigations/         # coincidencia con catálogo, rechazo not_checkable
apps/extension/wxt.config.ts                 # permisos
apps/extension/scripts/check-bundle.mjs      # guardia de permisos
apps/extension/entrypoints/background.ts     # menú contextual, panel global
apps/extension/src/lib/{selection,chrome-bridge}.ts
apps/extension/entrypoints/sidepanel/App.tsx
apps/extension/src/components/{ManualClaim,InvestigationView}.tsx
apps/extension/e2e/{extension.spec.ts,fixtures/article.html}
docs/{privacy,gates}.md
```

**Structure Decision**: la de 001, sin directorios nuevos salvo el fixture E2E.

## Phases & slices (estado compartido entre sesiones)

Cada slice se ejecuta en un contexto nuevo, marca sus tareas en `tasks.md` y hace commit en
`002-web-claim-investigation`.

1. **S1 — Contratos + backend**: contratos, migración, coincidencia con catálogo, `not_checkable`, tests de integración.
2. **S2 — Extensión**: permisos, menú contextual, panel global, flujo de selección, copy US4.
3. **S3 — E2E + documentación**: fixture de artículo DEMO, E2E US1–US4 y SC-002/006, privacidad, gates, quickstart.

## Complexity Tracking

Sin violaciones que justificar.
