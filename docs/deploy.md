# Despliegue — beta cerrada en DigitalOcean App Platform

Plantilla: `infra/digitalocean-app.yaml` (API + worker + PostgreSQL gestionado, ≈25 $/mes sin LLM). Una sola imagen
(`Dockerfile`) sirve para migraciones, API y worker. Release y rollback: `docs/release.md`.

## Requisitos (tú)

- Cuenta de DigitalOcean con método de pago y `doctl` autenticado (`doctl auth init`).
- La app de GitHub de DigitalOcean con acceso al repositorio `nacorga/polifamia`.
- `ANTHROPIC_API_KEY` y `FACTCHECK_API_KEY` (Google Cloud → API «Fact Check Tools» → credencial de API key).

## Primer despliegue

1. `doctl apps create --spec infra/digitalocean-app.yaml` → anota el `id` de la app.
2. Consola → la app → Settings → App-Level Environment Variables: rellena `ANTHROPIC_API_KEY` y `FACTCHECK_API_KEY`
   (cifradas) → Save. Esto lanza un nuevo despliegue: job `migrate` → API → worker.
3. Comprueba en la consola que los tres componentes quedan en verde y anota la URL pública
   (`https://polifamia-beta-<hash>.ondigitalocean.app`).
4. Smoke:

   ```bash
   API=https://polifamia-beta-<hash>.ondigitalocean.app
   curl $API/health                                      # {"status":"ok","db":true}
   curl -X POST $API/v1/investigations -H 'content-type: application/json' \
     -d "{\"manualClaim\":\"La tasa de paro en España fue del 11,3 % en 2024.\",\"idempotencyKey\":\"$(uuidgen)\"}"
   curl $API/v1/investigations/<id>                      # COMPLETED/INSUFFICIENT_EVIDENCE sin [DEMO]
   ```

El catálogo de vídeos queda vacío en producción: los vídeos DEMO no se importan y los reales esperan al gate G0. En
YouTube el panel mostrará «no compatible» + «Pegar una afirmación»; la selección en artículos funciona completa.

## Dominio propio (opcional, antes de publicar en la Store)

La URL del API va compilada en la extensión (`host_permissions`): cambiarla después obliga a publicar versión nueva y
pasar otra revisión. Para testers con zip basta la URL `ondigitalocean.app`; para la Store conviene fijar antes el
dominio definitivo:

1. Consola → la app → Settings → Domains → Add domain `api.<tu-dominio>`.
2. Crea en tu DNS el `CNAME` que indica DigitalOcean; el certificado HTTPS es automático.
3. Repite el smoke con el dominio nuevo.

## Empaquetar la extensión

```bash
WXT_API_URL=https://<api> pnpm zip:extension
# → apps/extension/.output/polifamiaextension-<versión>-chrome.zip
```

Falla si `WXT_API_URL` no es https, si el bundle contiene secretos o si los permisos cambian
(`scripts/check-bundle.mjs`). Para testers sin Store: descomprimir y «Cargar descomprimida» en `chrome://extensions`.
Publicación en la Store: `docs/store-listing.md`.

## Operación

- **Coste**: `DAILY_BUDGET_EUR` (5 por defecto) corta las investigaciones nuevas al alcanzarse; la caché sigue
  sirviendo. Consulta: `SELECT sum(cost_eur) FROM investigations WHERE created_at >= current_date;`
  (Consola → base de datos → «Connection details» / `doctl databases connection <db-id>`).
- **Actualizar**: `deploy_on_push` está desactivado; tras merge a `main`, Consola → «Deploy» o
  `doctl apps create-deployment <app-id>`. Cambios de spec: `doctl apps update <app-id> --spec infra/digitalocean-app.yaml`.
- **TLS de la BD**: la conexión se verifica contra la CA de la base gestionada (`DATABASE_CA_CERT = ${db.CA_CERT}`).
  Sin esa variable, `pg` rechaza el certificado y API/worker no arrancan.
- **Parar todo el gasto LLM**: `INVESTIGATION_MODE=demo` (o `DAILY_BUDGET_EUR=0.01`).
