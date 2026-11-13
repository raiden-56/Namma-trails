# syntax=docker/dockerfile:1.7
#
# API image (NestJS + Prisma). Build it from the repository root:
#
#   docker build -f apps/api/Dockerfile -t namma-trails-api .
#
# The same image does two jobs on AWS:
#   - the API itself          (default command: node dist/main.js)
#   - the database migration  (command: node_modules/.bin/prisma migrate deploy)
#
# Company networks that inspect HTTPS: the build cannot download packages unless it
# trusts the company's root certificate. Pass that certificate as a build secret:
#
#   docker build --secret id=extra_ca,src=/path/to/company-root.pem ...
#
# With AWS CDK, set NODE_EXTRA_CA_CERTS to that file before `cdk deploy`. On a normal
# network, leave it out. The certificate is only used while building; it is not kept
# in the image.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl: needed by the Prisma migration engine.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /repo

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
# Manifests first: the install layer is reused until a dependency changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/package.json
COPY apps/api/package.json apps/api/package.json
# Download pnpm itself (the version named in package.json) in its own cached step.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi \
 && corepack install
# The cache mounts keep downloaded packages between builds. The long timeout and the
# retries let the install finish on a slow connection too.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    --mount=type=cache,id=pnpm-cache,target=/root/.cache/pnpm \
    --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi \
 && pnpm install --frozen-lockfile --store-dir /pnpm/store \
      --fetch-timeout 300000 --fetch-retries 5 --filter "@kt/api..."
COPY packages/domain packages/domain
COPY apps/api apps/api
RUN pnpm --filter @kt/domain build && pnpm --filter @kt/api build

# ── Run ──────────────────────────────────────────────────────────────────────
FROM base AS runtime
# Amazon RDS certificate authorities, so the API can check it is really talking to
# its own database (the connection uses sslmode=verify-full).
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/certs/rds-global-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/rds-global-bundle.pem
COPY --from=build --chown=node:node /repo /repo
WORKDIR /repo/apps/api
USER node
ENV PORT=4000
EXPOSE 4000
# The entrypoint builds DATABASE_URL from the DB_* values AWS injects, then runs the command.
ENTRYPOINT ["node", "docker-entrypoint.mjs"]
CMD ["node", "dist/main.js"]
