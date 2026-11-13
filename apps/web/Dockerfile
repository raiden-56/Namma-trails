# syntax=docker/dockerfile:1.7
#
# Web image (Next.js, standalone output). Build it from the repository root:
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://example.com \
#     --build-arg NEXT_PUBLIC_API_URL=https://example.com/api/v1 \
#     -t namma-trails-web .
#
# The two NEXT_PUBLIC_ values are written into the pages when the image is built
# (page addresses, site map, sharing pictures, and where the browser calls the API).
# A new web address therefore needs a new image.
#
# Company networks that inspect HTTPS: the build cannot download packages or the
# Google fonts unless it trusts the company's root certificate. Pass that certificate
# as a build secret:
#
#   docker build --secret id=extra_ca,src=/path/to/company-root.pem ...
#
# With AWS CDK, set NODE_EXTRA_CA_CERTS to that file before `cdk deploy`. On a normal
# network, leave it out. The certificate is only used while building; it is not kept
# in the image.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
# ca-certificates: the Next.js builder checks HTTPS against the system certificate
# store when it downloads the fonts, and the slim image comes without one.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /repo

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
# Manifests first: the install layer is reused until a dependency changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/package.json
COPY apps/web/package.json apps/web/package.json
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
      --fetch-timeout 300000 --fetch-retries 5 --filter "@kt/web..."
COPY packages/domain packages/domain
COPY apps/web apps/web
# The /user-manual page is made from this file at build time.
COPY docs/FEATURES.md docs/FEATURES.md

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_OUTPUT=standalone
# The web build downloads the three Google fonts, so it needs the internet. The font
# download uses the system certificate store (SSL_CERT_FILE), not Node's, so an extra
# company certificate is added to a copy of that store for this one step.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then \
      export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; \
      cat /etc/ssl/certs/ca-certificates.crt /run/secrets/extra_ca > /tmp/ca-bundle.crt; \
      export SSL_CERT_FILE=/tmp/ca-bundle.crt; \
    fi \
 && pnpm --filter @kt/domain build && pnpm --filter @kt/web build

# ── Run ──────────────────────────────────────────────────────────────────────
FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# The standalone folder already holds the server and only the packages it needs.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
