# FakeRESTApi DaloyJS Benchmark Report

Date: 2026-05-15

This report documents a local stress benchmark against the DaloyJS FakeRESTApi server. The goal was to test whether the server remains correct and responsive under sustained and bursty request pressure, not to claim a universal comparison against every JavaScript framework.

## Summary

The server handled approximately 258,000 total requests across three stress waves with no server-side failures observed:

- 0 server-returned 5xx responses
- 0 unexpected HTTP statuses
- 0 application crashes
- 0 failed post-test health checks
- Sustained approximately 6,000 requests per second at 500 concurrency
- Remained responsive after an effective 1,000-concurrency burst

At 500 concurrent clients for 20 seconds, the server processed 122,452 requests at 6,089.62 requests per second with p50 latency of 73.04 ms and p99 latency of 199.76 ms.

## Tested Application

Project: `daloyjs-large-fakerestapi`

Runtime and framework:

- Node.js: v25.7.0 during this run
- Package manager: pnpm
- Framework dependency: `@daloyjs/core` `^0.1.2`
- Server entrypoint: `pnpm start`, which runs `tsx scripts/serve.ts`
- Benchmark harness: `scripts/stress.ts`

Application surface:

- 108 deterministic resources
- 713 endpoints reported by `/api/v1/_meta`
- OpenAPI JSON and YAML endpoints
- Swagger UI endpoint
- List, item, mutation, relationship, metadata, and intentional 404 routes

The benchmark was run against the local Node server at `http://localhost:3000`.

## Environment

The benchmark was executed locally on macOS from VS Code terminal sessions. The server and load generator ran on the same machine, so the results include local machine limits such as CPU scheduling, loopback networking, Node fetch behavior, and client-side socket pressure.

Important caveat: because the load generator and server shared one machine, these numbers should be interpreted as a local resilience signal, not as a production capacity number.

## Benchmark Harness

The benchmark harness is located at `scripts/stress.ts`.

It starts a configurable number of asynchronous workers. Each worker repeatedly selects a request from a weighted route mix, sends the request, drains the response body, records status and latency, and immediately sends the next request until the duration expires.

Example usage:

```bash
pnpm start
pnpm tsx scripts/stress.ts --duration=20 --concurrency=500 --label=sustained-500
```

Supported options:

```bash
pnpm tsx scripts/stress.ts \
  --url=http://localhost:3000 \
  --duration=10 \
  --concurrency=200 \
  --label=wave-name
```

Metrics recorded:

- Total request count
- Requests per second
- Expected successful responses
- Unexpected statuses
- Network errors
- HTTP status distribution
- Latency min, p50, p90, p99, and max
- Per-endpoint request count, expected-ok count, average latency, and max latency

## Request Mix

The benchmark intentionally used a mixed workload instead of repeatedly hitting one simple endpoint.

| Endpoint pattern | Method | Expected status | Weight | Purpose |
|---|---:|---:|---:|---|
| `/api/v1/Activities` | GET | 200 | 3 | Resource list route |
| `/api/v1/Products/:id` | GET | 200 | 3 | Single resource lookup |
| `/api/v1/Orders/:id` | GET | 200 | 3 | Nested relationship-heavy resource |
| `/api/v1/Customers/:id/orders` | GET | 200 | 2 | Relationship traversal route |
| `/api/v1/Books` | POST | 200 or 201 | 2 | JSON body parsing and mutation-style route |
| `/api/v1/Cars/9999` | GET | 404 | 1 | Expected not-found path |
| `/swagger/v1/swagger.json` | GET | 200 | 1 | Large OpenAPI document route |

The intentional 404 route is counted as expected success when it returns 404.

## Commands Run

Start server:

```bash
pnpm start
```

Warmup wave:

```bash
pnpm tsx scripts/stress.ts --duration=5 --concurrency=50 --label=warmup
```

Sustained wave:

```bash
pnpm tsx scripts/stress.ts --duration=20 --concurrency=500 --label=sustained-500
```

Burst wave using four parallel client processes:

```powershell
$procs = 1..4 | ForEach-Object {
  $i = $_
  Start-Process -FilePath pnpm `
    -ArgumentList @("tsx", "scripts/stress.ts", "--duration=15", "--concurrency=250", "--label=burst-p$i") `
    -RedirectStandardOutput "$env:TMPDIR/stress-$i.log" `
    -RedirectStandardError "$env:TMPDIR/stress-$i.err" `
    -PassThru `
    -NoNewWindow
}
$procs | ForEach-Object { $_.WaitForExit() }
```

Post-test health check:

```powershell
(Invoke-WebRequest http://localhost:3000/api/v1/_meta -UseBasicParsing).Content
(Invoke-WebRequest http://localhost:3000/api/v1/Activities -UseBasicParsing).StatusCode
```

## Results Overview

| Wave | Effective concurrency | Duration | Total requests | Throughput | Expected OK | Unexpected statuses | Network errors | Status codes | p50 | p90 | p99 | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|
| warmup | 50 | 5.01 s | 29,960 | 5,982.00 rps | 29,960 | 0 | 0 | 200=27,884, 404=2,076 | 7.64 ms | 11.77 ms | 19.70 ms | 213.27 ms |
| sustained-500 | 500 | 20.11 s | 122,452 | 6,089.62 rps | 122,452 | 0 | 0 | 200=114,250, 404=8,202 | 73.04 ms | 104.18 ms | 199.76 ms | 3,335.15 ms |
| burst aggregate | ~1,000 | ~15-17 s | 106,441 | ~6,671.85 rps | 106,230 | 0 | 211 | 200=99,182, 404=7,048 | 91-108 ms per process | 122-195 ms per process | 209-7,264 ms per process | 11,771.63 ms |

Total across all completed waves:

- Total requests: 258,853
- Expected OK responses: 258,642
- Unexpected statuses: 0
- Network errors: 211
- Server 5xx responses: 0 observed

The 211 network errors occurred only during the multi-process burst wave and represented approximately 0.20% of burst requests. No server 5xx responses were observed during that wave.

## Warmup Wave Details

Configuration:

- Duration: 5 seconds
- Concurrency: 50
- Total requests: 29,960
- Throughput: 5,982.00 rps
- Expected OK: 29,960
- Unexpected statuses: 0
- Network errors: 0
- Status codes: 200=27,884, 404=2,076
- Latency: min=0.87 ms, p50=7.64 ms, p90=11.77 ms, p99=19.70 ms, max=213.27 ms

Per-endpoint results:

| Endpoint | Requests | Expected OK | Average latency | Max latency |
|---|---:|---:|---:|---:|
| GET `/api/v1/Products/:id` | 5,959 | 5,959 | 8.26 ms | 205.82 ms |
| GET `/api/v1/Customers/:id/orders` | 4,038 | 4,038 | 8.18 ms | 115.72 ms |
| GET `/api/v1/Orders/:id` | 5,967 | 5,967 | 8.25 ms | 213.27 ms |
| GET `/api/v1/Activities` | 5,952 | 5,952 | 8.23 ms | 174.44 ms |
| GET `/swagger/v1/swagger.json` | 1,988 | 1,988 | 9.33 ms | 99.16 ms |
| POST `/api/v1/Books` | 3,980 | 3,980 | 8.58 ms | 186.25 ms |
| GET `/api/v1/Cars/9999` | 2,076 | 2,076 | 8.18 ms | 93.30 ms |

## Sustained 500-Concurrency Wave Details

Configuration:

- Duration: 20 seconds
- Concurrency: 500
- Total requests: 122,452
- Throughput: 6,089.62 rps
- Expected OK: 122,452
- Unexpected statuses: 0
- Network errors: 0
- Status codes: 200=114,250, 404=8,202
- Latency: min=2.68 ms, p50=73.04 ms, p90=104.18 ms, p99=199.76 ms, max=3,335.15 ms

Per-endpoint results:

| Endpoint | Requests | Expected OK | Average latency | Max latency |
|---|---:|---:|---:|---:|
| GET `/api/v1/Customers/:id/orders` | 16,458 | 16,458 | 82.22 ms | 3,202.55 ms |
| GET `/api/v1/Activities` | 24,365 | 24,365 | 80.21 ms | 3,201.96 ms |
| GET `/api/v1/Orders/:id` | 24,456 | 24,456 | 80.59 ms | 2,685.13 ms |
| GET `/api/v1/Products/:id` | 24,570 | 24,570 | 80.36 ms | 3,173.54 ms |
| GET `/api/v1/Cars/9999` | 8,202 | 8,202 | 78.64 ms | 2,560.89 ms |
| GET `/swagger/v1/swagger.json` | 8,026 | 8,026 | 88.31 ms | 3,335.15 ms |
| POST `/api/v1/Books` | 16,375 | 16,375 | 86.81 ms | 2,438.09 ms |

## Burst Wave Details

Configuration:

- Four independent client processes
- Each process ran 250 concurrent workers
- Effective target concurrency: approximately 1,000
- Duration per process: 15 seconds

Aggregate result:

- Total requests: 106,441
- Expected OK: 106,230
- Unexpected statuses: 0
- Network errors: 211
- Status codes: 200=99,182, 404=7,048
- Approximate aggregate throughput: 6,671.85 rps

Per-process results:

| Process | Elapsed | Requests | RPS | Expected OK | Unexpected statuses | Network errors | Status codes | p50 | p90 | p99 | Max |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|
| burst-p1 | 16.29 s | 33,716 | 2,069.91 | 33,656 | 0 | 60 | 200=31,432, 404=2,224 | 91.11 ms | 122.59 ms | 209.76 ms | 6,633.37 ms |
| burst-p2 | 16.25 s | 31,934 | 1,964.97 | 31,915 | 0 | 19 | 200=29,801, 404=2,114 | 98.28 ms | 131.22 ms | 474.01 ms | 11,761.65 ms |
| burst-p3 | 16.91 s | 9,764 | 577.51 | 9,632 | 0 | 132 | 200=8,973, 404=659 | 108.47 ms | 194.58 ms | 7,263.69 ms | 11,771.63 ms |
| burst-p4 | 15.07 s | 31,027 | 2,059.46 | 31,027 | 0 | 0 | 200=28,976, 404=2,051 | 92.95 ms | 128.20 ms | 1,104.18 ms | 9,065.27 ms |

The burst produced client-side network errors in three of the four load-generator processes. Since the server returned no 5xx responses and passed health checks afterward, these errors are best interpreted as local client/socket pressure during the benchmark rather than application-level failures.

## Post-Test Health Check

After the stress waves, the server responded successfully to both metadata and resource-list checks.

Metadata response:

```json
{"title":"FakeRESTApi.DaloyJS.V1","version":"1.0","resources":108,"endpointCount":713,"swagger":{"json":"/swagger/v1/swagger.json","yaml":"/swagger/v1/swagger.yaml","ui":"/index.html"}}
```

Activities status check:

```text
200
```

This confirms the server was still alive and responsive after the bombardment.

## Interpretation

The benchmark shows strong local resilience for this app and workload.

The most important result is correctness under pressure. Across the completed waves, there were no unexpected HTTP statuses and no server-returned 5xx responses. Even under the burst test, the server continued returning valid 200 and expected 404 responses.

Throughput plateaued around 6,000 to 6,700 requests per second on this local setup. Increasing concurrency from 50 to 500 raised latency but did not reduce correctness. Moving to an effective 1,000-concurrency burst increased tail latency and triggered a small number of client-side network errors, but the server remained responsive afterward.

The latency profile is consistent with a server that keeps draining work under pressure: p50 and p90 rise as concurrency increases, but requests continue completing correctly. The sustained 500-concurrency wave is the cleanest result for public reporting because it had high throughput, no network errors, no unexpected statuses, and p99 latency under 200 ms.

## Suggested Public Claim

A conservative, supportable claim:

> In a local stress benchmark of the DaloyJS FakeRESTApi app with 108 resources and 713 endpoints, a single Node.js server sustained approximately 6,000 requests per second at 500 concurrency for 20 seconds with zero server errors, zero unexpected statuses, and p99 latency around 200 ms. It remained responsive after a higher burst test of approximately 1,000 effective concurrent clients.

A shorter version:

> DaloyJS handled a 713-endpoint FakeRESTApi workload at approximately 6k requests/sec locally with no server errors and remained healthy after burst testing.

## What This Does Not Prove

This benchmark does not prove that DaloyJS is faster than, equal to, or slower than every existing JavaScript framework. To make that claim, the same workload would need to be implemented and benchmarked under the same conditions in other frameworks such as Fastify, Hono, Elysia, Express, or Koa.

This benchmark also does not represent production capacity. Production results depend on hardware, deployment runtime, reverse proxy configuration, CPU limits, memory limits, logging, TLS, network distance, and concurrency behavior from real clients.

## Recommended Next Benchmarks

For stronger public comparison, run a framework shootout with the same workload and measurement rules:

- Same Node.js version
- Same machine or isolated container resources
- Same route mix
- Same response payloads
- Same JSON body parsing behavior
- Same OpenAPI route behavior
- Same concurrency waves
- CPU and memory tracking
- Multiple repeated runs with median and variance reported

Recommended comparison targets:

- DaloyJS
- Fastify
- Hono
- Elysia
- Express

Recommended additional metrics:

- CPU utilization
- Memory RSS
- Event loop delay
- Garbage collection behavior
- Process restart behavior after overload
- Throughput under remote load generation instead of same-machine load generation
