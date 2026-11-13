# Architecture & planning docs

Phase 0 deliverables for the Karnataka tourism marketplace (working brand **Namma Trails**, configurable).

| # | Document | Covers |
|---|----------|--------|
| 01 | [Product requirements](01-product-requirements.md) | Vision, personas, scope per phase, definition of done |
| 02 | [System architecture](02-architecture.md) | Technology decisions, architecture diagram, module boundaries, folder structure |
| 03 | [Roles & permissions](03-roles-permissions.md) | Role catalog, permission matrix, tenant isolation |
| 04 | [Provider onboarding](04-provider-onboarding.md) | Self-registration, KYC documents, verification workflow, publish gate |
| 05 | [Booking engine](05-booking-engine.md) | Booking lifecycle & state machine, category availability strategies, trips/saga, payments flow |
| 06 | [Data model](06-data-model.md) | ER diagram, entity responsibilities, invariants, data boundaries, retention |
| 07 | [API specification](07-api.md) | Conventions, endpoint inventory, idempotency, webhooks |
| 08 | [Design system](08-design-system.md) | Kolibrie-inspired visual language, tokens, components, motion rules |
| 09 | [Pages & routes](09-routes.md) | Full page and route inventory per experience |
| 10 | [Destination launch strategy](10-destination-launch.md) | Readiness criteria, rollout phases, admin controls |
| 11 | [Deployment & hosting](11-deployment.md) | Environments, hosting recommendation, CI/CD, backups, rollback |
| 12 | [Security & compliance](12-security-compliance.md) | Security controls checklist, DPDP, payments, safety |
| 13 | [Risk register](13-risk-register.md) | Technical and business risks with mitigations |
| 14 | [Roadmap & progress](14-roadmap.md) | Phased plan, dependencies, testing strategy, **live progress checklist** |
| 15 | [Demo data & test guide](15-demo-data.md) | Demo accounts for every role and end-to-end test scenarios |
| — | [Features & user flow](FEATURES.md) | What the app does today, the flow step by step, and a screenshot of every main screen |
| — | [Hosting on AWS](../infra/README.md) | The AWS CDK setup: what it builds, auto scaling, cost, and how to deploy |

Source of truth for business rules is code, not prose: `packages/domain` (state machines, pricing, commission, refunds, availability, RBAC) and `apps/api/prisma/schema.prisma` + `apps/api/prisma/sql/constraints.sql`. These documents explain them and link to them.
