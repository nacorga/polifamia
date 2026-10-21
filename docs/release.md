# Release y rollback (beta técnica)

Plantilla de despliegue: `infra/digitalocean-app.yaml` (API + worker + PostgreSQL gestionado, imagen `Dockerfile`).
Primer despliegue paso a paso: `docs/deploy.md`. Ficha de la Store: `docs/store-listing.md`.

## Release

1. CI verde en `main` (typecheck, lint, format, tests con PostgreSQL, build, E2E, `drizzle-kit check`).
2. Revisar migraciones nuevas en `apps/api/drizzle/` (SQL legible; nada destructivo sin plan).
3. Desplegar: el job `PRE_DEPLOY` aplica migraciones; después API y worker.
4. Smoke: `GET /health`, availability de un vídeo del catálogo, una investigación de prueba.
5. Extensión: `WXT_API_URL=https://<api> pnpm zip:extension`;
   el build falla si el bundle contiene secretos o permisos fuera de lo esperado (`scripts/check-bundle.mjs`).
   Distribución beta cerrada: carga descomprimida o Chrome Web Store como «privada» tras revisión.

## Rollback

- **API/worker**: App Platform → «Rollback» al despliegue anterior. Los jobs en curso se reintentan (pg-boss).
- **Migraciones**: solo aditivas en beta; un rollback de código no requiere revertir el esquema.
  Si una migración debe revertirse, escribir una migración inversa revisada (no editar la ya aplicada).
- **Coste**: bajar `DAILY_BUDGET_EUR` a `0.01` corta investigaciones nuevas al instante (la caché sigue).
  `INVESTIGATION_MODE=demo` desactiva por completo las llamadas a proveedores.

## Alertas simples

- Health check de App Platform sobre `/health` (incluye conexión a BD).
- Logs JSON: buscar `"level":50` (errores) y `"stage":"failed"` por `failureReason`.
- Coste diario: `SELECT sum(cost_eur) FROM investigations WHERE created_at >= current_date;`
