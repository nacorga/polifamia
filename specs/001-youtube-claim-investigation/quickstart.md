# Quickstart — 001 MVP

Validación reproducible del flujo completo (se actualiza en cada slice).

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d     # PostgreSQL :5432
cp .env.example .env                                  # INVESTIGATION_MODE=demo por defecto
pnpm db:migrate
pnpm import:transcripts corpus/videos                 # importa los vídeos DEMO con sus derechos
pnpm dev:api & pnpm dev:worker &                      # API :3000 + worker
pnpm dev:extension                                    # WXT abre Chrome con la extensión
```

1. Abrir un vídeo DEMO del catálogo (IDs en `corpus/videos/*.rights.json`) y pulsar el icono →
   panel «Análisis disponible · DEMO» con afirmaciones.
2. Pulsar una afirmación → el vídeo salta al minuto sin pausarse.
3. Pulsar **Investigar** → progreso → resultado (etiquetado DEMO en modo demo).
4. Abrir cualquier otro vídeo → «Vídeo todavía no compatible» → **Pegar una afirmación**.
5. «Hay un problema con esta investigación» → confirmación.

Checks: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`.

Modo real: `INVESTIGATION_MODE=real`, `ANTHROPIC_API_KEY`, `FACTCHECK_API_KEY` en `.env` del servidor.
