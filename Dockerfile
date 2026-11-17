# The image Cloud Run runs. See docs/deploy-on-google-cloud.md.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The build needs no database, storage or email settings: those are read
# when the container starts.
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN npm run build

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# The migrations, run by the Cloud Run job with `node db/migrate.mjs`.
COPY --from=build --chown=node:node /app/db ./db
USER node
EXPOSE 8080
CMD ["node", "server.js"]
