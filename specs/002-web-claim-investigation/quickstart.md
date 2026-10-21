# Quickstart — 002

Requisitos y arranque: `specs/001-youtube-claim-investigation/quickstart.md` (BD, migraciones, importación DEMO, API,
worker, `pnpm dev:extension`).

## Automático

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm format:check
pnpm e2e   # incluye el artículo DEMO en https://diario.example/
```

Esperado: tests de contrato/API de 002 en verde (coincidencia con catálogo, `not_checkable`, `origin`, campos extra
rechazados) y E2E US1–US4, SC-002 y SC-006.

## Manual (gesto real del menú contextual)

1. Cargar `apps/extension/.output/chrome-mv3` en `chrome://extensions` (modo desarrollador) con la API en modo DEMO.
2. Abrir cualquier noticia http(s), seleccionar «La inflación interanual cerró 2023 en el 3,1 %.» (o pegarla en una
   página propia) → clic derecho → **Investigar esta afirmación**.
   - Esperado: el panel se abre a la primera, muestra la frase, el medio y la dirección sin `?` ni `#`, y el aviso
     «solo se envía el texto».
3. Pestaña Network del panel: antes de confirmar, 0 peticiones a `/v1/investigations`; al confirmar, el body tiene solo
   `manualClaim`, `origin` e `idempotencyKey`.
4. Resultado DEMO con «texto seleccionado por ti en <medio>» y sin «Volver al minuto».
5. `chrome://newtab`, `chrome://extensions`, un `file://` y un PDF: el item del menú no aparece o el panel explica que
   la página no es compatible.
6. Abrir una página y navegar sin invocar la extensión: ninguna petición al servicio.

Registrar el resultado en `docs/gates.md` (G5 — selección web).
