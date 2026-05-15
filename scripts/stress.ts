/**
 * Stress / load test for the FakeRESTApi (daloy) server.
 *
 * Usage:
 *   pnpm tsx scripts/stress.ts [--url=http://localhost:3000] [--duration=10] [--concurrency=200] [--label=wave]
 *
 * Runs N concurrent workers that fire requests as fast as the server replies for `duration` seconds,
 * across a mix of endpoints (GET light, GET heavy, GET nested relationship, POST, 404). Reports:
 *   - total requests / RPS
 *   - status code distribution
 *   - latency p50 / p90 / p99 / max
 *   - error count (network / non-2xx-or-expected)
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
) as Record<string, string>;

const URL_BASE = args.url ?? "http://localhost:3000";
const DURATION_S = Number(args.duration ?? 10);
const CONCURRENCY = Number(args.concurrency ?? 200);
const LABEL = args.label ?? `c${CONCURRENCY}-${DURATION_S}s`;

type Job = {
  name: string;
  weight: number;
  build: () => { path: string; init?: RequestInit };
  expect: (status: number) => boolean;
};

const jobs: Job[] = [
  {
    name: "GET /Activities",
    weight: 3,
    build: () => ({ path: "/api/v1/Activities" }),
    expect: (s) => s === 200,
  },
  {
    name: "GET /Products/:id",
    weight: 3,
    build: () => ({ path: `/api/v1/Products/${1 + Math.floor(Math.random() * 30)}` }),
    expect: (s) => s === 200,
  },
  {
    name: "GET /Orders/:id (nested)",
    weight: 3,
    build: () => ({ path: `/api/v1/Orders/${1 + Math.floor(Math.random() * 10)}` }),
    expect: (s) => s === 200,
  },
  {
    name: "GET /Customers/:id/orders",
    weight: 2,
    build: () => ({ path: `/api/v1/Customers/${1 + Math.floor(Math.random() * 10)}/orders` }),
    expect: (s) => s === 200,
  },
  {
    name: "POST /Books",
    weight: 2,
    build: () => ({
      path: "/api/v1/Books",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Stress Book", pageCount: 42 }),
      },
    }),
    expect: (s) => s === 200 || s === 201,
  },
  {
    name: "GET /Cars/9999 (404)",
    weight: 1,
    build: () => ({ path: "/api/v1/Cars/9999" }),
    expect: (s) => s === 404,
  },
  {
    name: "GET /swagger.json",
    weight: 1,
    build: () => ({ path: "/swagger/v1/swagger.json" }),
    expect: (s) => s === 200,
  },
];

const weighted: Job[] = [];
for (const j of jobs) for (let i = 0; i < j.weight; i++) weighted.push(j);

function pickJob(): Job {
  return weighted[Math.floor(Math.random() * weighted.length)]!;
}

type Stats = {
  total: number;
  ok: number;
  unexpected: number;
  errors: number;
  byStatus: Map<number, number>;
  byJob: Map<string, { n: number; ok: number; sumMs: number; maxMs: number }>;
  latencies: number[]; // ms
};

const stats: Stats = {
  total: 0,
  ok: 0,
  unexpected: 0,
  errors: 0,
  byStatus: new Map(),
  byJob: new Map(),
  latencies: [],
};

let stop = false;

async function worker() {
  while (!stop) {
    const job = pickJob();
    const { path, init } = job.build();
    const t0 = performance.now();
    try {
      const res = await fetch(URL_BASE + path, init);
      // drain body to free socket
      await res.arrayBuffer();
      const dt = performance.now() - t0;
      stats.total++;
      stats.latencies.push(dt);
      stats.byStatus.set(res.status, (stats.byStatus.get(res.status) ?? 0) + 1);
      const okExpected = job.expect(res.status);
      if (okExpected) stats.ok++;
      else stats.unexpected++;
      const js = stats.byJob.get(job.name) ?? { n: 0, ok: 0, sumMs: 0, maxMs: 0 };
      js.n++;
      if (okExpected) js.ok++;
      js.sumMs += dt;
      if (dt > js.maxMs) js.maxMs = dt;
      stats.byJob.set(job.name, js);
    } catch (_err) {
      stats.total++;
      stats.errors++;
    }
  }
}

function pct(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const i = Math.min(arr.length - 1, Math.floor((p / 100) * arr.length));
  return arr[i]!;
}

function fmt(n: number, d = 2): string {
  return Number.isFinite(n) ? n.toFixed(d) : "n/a";
}

async function main() {
  console.log(
    `\n=== STRESS WAVE [${LABEL}] -> ${URL_BASE}  concurrency=${CONCURRENCY}  duration=${DURATION_S}s ===`,
  );

  // warmup ping
  try {
    const r = await fetch(URL_BASE + "/api/v1/_meta");
    await r.arrayBuffer();
    if (!r.ok) console.warn("warmup non-ok:", r.status);
  } catch (e) {
    console.error("Server unreachable at", URL_BASE, e);
    process.exit(1);
  }

  const startedAt = performance.now();
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  const timer = setTimeout(() => {
    stop = true;
  }, DURATION_S * 1000);

  await Promise.all(workers);
  clearTimeout(timer);
  const elapsedS = (performance.now() - startedAt) / 1000;

  const lat = stats.latencies.sort((a, b) => a - b);
  const rps = stats.total / elapsedS;

  console.log(`\n--- Results [${LABEL}] ---`);
  console.log(`elapsed:        ${fmt(elapsedS)}s`);
  console.log(`requests:       ${stats.total}  (rps=${fmt(rps)})`);
  console.log(`expected ok:    ${stats.ok}`);
  console.log(`unexpected sts: ${stats.unexpected}`);
  console.log(`network errors: ${stats.errors}`);
  console.log(`status codes:   ${[...stats.byStatus.entries()].map(([s, n]) => `${s}=${n}`).join(" ")}`);
  console.log(
    `latency ms:     min=${fmt(lat[0] ?? 0)} p50=${fmt(pct(lat, 50))} p90=${fmt(pct(lat, 90))} p99=${fmt(pct(lat, 99))} max=${fmt(lat[lat.length - 1] ?? 0)}`,
  );
  console.log(`per-endpoint:`);
  for (const [name, js] of stats.byJob) {
    console.log(
      `  ${name.padEnd(32)} n=${String(js.n).padStart(6)}  ok=${String(js.ok).padStart(6)}  avg=${fmt(js.sumMs / js.n)}ms  max=${fmt(js.maxMs)}ms`,
    );
  }
  // reset for next wave if imported
  stop = false;
}

await main();
