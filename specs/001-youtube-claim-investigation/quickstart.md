# Quickstart — 001 MVP

Validación reproducible del flujo completo (se actualiza en cada slice). Requiere Node ≥22.12, pnpm y Docker.

```bash
pnpm install
pnpm db:up                                # PostgreSQL 16 en :5432 (bd polifamia y polifamia_test)
cp .env.example .env                      # INVESTIGATION_MODE=demo, API en :3100
pnpm db:migrate
pnpm import:transcripts corpus/videos     # importa los 2 vídeos DEMO con sus derechos (idempotente)
pnpm dev:api                              # terminal 1 — API :3100
pnpm dev:worker                           # terminal 2 — worker pg-boss
```

Comprobación del backend:

```bash
curl localhost:3100/health
curl localhost:3100/v1/videos/DEMOvideo01/availability     # claims_ready, isDemo
curl localhost:3100/v1/videos/dQw4w9WgXcQ/availability     # unsupported_video
CID=$(curl -s localhost:3100/v1/videos/DEMOvideo01/claims | node -pe 'JSON.parse(require("fs").readFileSync(0)).claims[0].id')
curl -X POST localhost:3100/v1/investigations -H 'content-type: application/json' \
  -d "{\"claimId\":\"$CID\",\"idempotencyKey\":\"$(uuidgen)\"}"            # 202 PENDING
curl localhost:3100/v1/investigations/<id>                                  # COMPLETED · [DEMO]
curl -X POST localhost:3100/v1/investigations/<id>/feedback -H 'content-type: application/json' \
  -d '{"reason":"wrong_source"}'                                            # 201
curl localhost:3100/openapi.json
```

Extensión:

```bash
pnpm build                                # genera apps/extension/.output/chrome-mv3 (API http://localhost:3100)
# o WXT_API_URL=https://api.ejemplo pnpm --filter @polifamia/extension build
pnpm dev:extension                        # alternativa: WXT abre Chrome con la extensión y recarga en caliente
```

Carga manual: `chrome://extensions` → «Modo de desarrollador» → «Cargar descomprimida» →
`apps/extension/.output/chrome-mv3`. Los vídeos DEMO usan IDs ficticios, así que en youtube.com real
`/watch?v=DEMOvideo01` no reproduce nada (el panel debería listar el catálogo DEMO; sin verificar a mano); con cualquier vídeo real se
ve el flujo «no compatible» + manual. El flujo completo con reproductor está cubierto por `pnpm e2e`.

1. Abrir un vídeo DEMO del catálogo y pulsar el icono → panel «Análisis disponible · DEMO».
2. Pulsar una afirmación → el vídeo salta al minuto sin pausarse.
3. Pulsar **Investigar** → progreso → resultado etiquetado DEMO.
4. Abrir otro vídeo → «Vídeo todavía no compatible» → **Pegar una afirmación**.
5. «Hay un problema con esta investigación» → confirmación.

Motor de afirmaciones (S3):

```bash
pnpm eval:extraction                      # offline-oracle: valida el arnés, no la calidad del modelo
pnpm eval:extraction -- --real            # requiere ANTHROPIC_API_KEY (coste real)
pnpm extract:claims <youtubeId>           # extrae y selecciona claims de un vídeo importado sin claims.json
```

Checks: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm e2e`
(los tests de integración usan `polifamia_test`; `DATABASE_URL_TEST` lo sobrescribe. `pnpm e2e` construye la
extensión en `.output/chrome-mv3-e2e` apuntando a :3199, recrea `polifamia_e2e`, levanta API + worker DEMO y
ejecuta Playwright; primera vez: `pnpm --filter @polifamia/extension exec playwright install chromium`).

Modo real (S4): `INVESTIGATION_MODE=real` en el `.env` del servidor y reiniciar `pnpm dev:worker`.

- Sin `ANTHROPIC_API_KEY`: el worker arranca y cada investigación termina `FAILED` con `failureReason: no_llm_key`.
- Con `ANTHROPIC_API_KEY`: recupera INE (series aprobadas) + corpus `corpus/documents`; con `FACTCHECK_API_KEY`
  también verificaciones existentes. Modelos: `LLM_MODEL_EXTRACT`, `LLM_MODEL_SYNTH`.

Evaluación del motor de evidencias:

```bash
pnpm eval:investigation              # offline: INE grabado + LLM guionizado (valida el pipeline determinista)
pnpm eval:investigation -- --real    # en vivo; requiere ANTHROPIC_API_KEY (gasta dinero)
pnpm --filter @polifamia/connectors record:fixtures   # regraba respuestas INE reales y el corpus BOE
```
