# API y worker (misma imagen; App Platform cambia el comando). La extensión no entra en la imagen.
FROM node:22-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter "@polifamia/api..." \
  && pnpm --filter "@polifamia/api..." run build
ENV NODE_ENV=production
USER node
CMD ["node", "apps/api/dist/main.js"]
