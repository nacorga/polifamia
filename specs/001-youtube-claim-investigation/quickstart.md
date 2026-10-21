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

Extensión (S2, pendiente):

1. Abrir un vídeo DEMO del catálogo y pulsar el icono → panel «Análisis disponible · DEMO».
2. Pulsar una afirmación → el vídeo salta al minuto sin pausarse.
3. Pulsar **Investigar** → progreso → resultado etiquetado DEMO.
4. Abrir otro vídeo → «Vídeo todavía no compatible» → **Pegar una afirmación**.
5. «Hay un problema con esta investigación» → confirmación.

Checks: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`
(los tests de integración usan `polifamia_test`; `DATABASE_URL_TEST` lo sobrescribe).

Modo real (S4): `INVESTIGATION_MODE=real`, `ANTHROPIC_API_KEY`, `FACTCHECK_API_KEY` en el `.env` del servidor.
