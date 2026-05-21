# daloyjs fakerestapi

A 
contract-first ergonomics on a non-trivial surface (~700 endpoints across 100+
resources). Same routes, same payloads, same OpenAPI/Swagger UI surface — built
with [`@daloyjs/core`](../README.md).

## What this port shows

| Capability                              | DaloyJS API used                              |
| --------------------------------------- | --------------------------------------------- |
| One App with secure defaults            | `new App({ bodyLimitBytes, requestTimeoutMs })` |
| Helmet-grade headers + request id       | `app.use(secureHeaders())`, `app.use(requestId())` |
| CORS with case-preserved exposed headers| `app.use(cors({ origin, exposedHeaders }))`   |
| Encapsulated plugin per resource        | `app.register(resourcePlugin(def), { prefix, tags })` |
| RFC 9457 problem+json on 404            | `throw new NotFoundError()`                   |
| Custom response headers per route       | `return { status, body, headers }`            |
| Single in-process test client           | `app.request(path, init)`                     |
| Multi-runtime adapters                  | `serve(app, ...)` (Node), `toFetchHandler(app)` (Vercel Functions) |

## Layout

```
src/
  app.ts                  # DaloyJS App factory: middleware + plugins
  index.ts                # Default app instance (re-exports buildApp())
  resources.ts            # Catalog of 100+ deterministic resources
  relationships.ts        # Nested-object enrichment (parent-child graphs)
  relationship-routes.ts  # Cross-resource relationship endpoint manifest
  openapi.ts              # OpenAPI 3 document generator
  yaml.ts                 # Tiny dependency-free YAML serializer
api/
  index.ts                # Vercel Node Function handler
scripts/
  serve.ts                # Node server entrypoint
  smoke.ts                # Manual smoke check
  check-headers.ts        # Header introspection
  dump-yaml.ts            # Dumps swagger.yaml to stdout
test/
  api.test.ts             # ~12 tests, mirror of the Daloy port
```

## Develop

```bash
pnpm install                         # install @daloyjs/core from npm + dev deps
pnpm typecheck
pnpm test
pnpm dev                             # localhost:3000  -> Scalar docs at /docs
```

## Deploy to Vercel

Use the `Other` framework preset. This repo deploys a Vercel Node Function, not
a Next.js app.

Recommended project settings:

- Framework Preset: `Other`
- Root Directory: `.`
- Install Command: `pnpm install`
- Build Command: `pnpm vercel-build`
- Output Directory: `public`
- Node.js Version: `24.x` or newer

The request routing and empty static output directory are already configured in
`vercel.json`, and the function entrypoint lives in `api/index.ts`.

## Endpoints at a glance

- `/api/v1/{Resource}` — list / create
- `/api/v1/{Resource}/{id}` — get / put / patch / delete
- `/api/v1/{Parent}/{id}/{relation}` — relationship traversals
- `/api/v1/Authors/authors/books/{idBook}` and `/api/v1/CoverPhotos/books/covers/{idBook}` — fakerestapi parity routes
- `/openapi.json` and `/openapi.yaml` — generated OpenAPI 3
- `/docs` — Scalar API reference UI
- `/api/v1/_meta` — service metadata + endpoint count

Mutations are **not persisted**; every GET is deterministic.

## Why this matters

The port keeps every test from the Daloy version *unchanged*. The only thing
that moved is the framework: routes are now defined with `app.route({ ... })`,
plugins are registered with `app.register(..., { prefix, tags })`, and 404s
flow through `NotFoundError` so they automatically render as RFC 9457
problem+json with the configured request id stamped on every response.
