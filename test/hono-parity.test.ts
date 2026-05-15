import assert from "node:assert/strict";
import test from "node:test";

import daloyApp from "../src/index.js";
import { buildOpenApi as buildDaloyOpenApi } from "../src/openapi.js";
import { RESOURCES } from "../src/resources.js";

type AppLike = {
  request(path: string, init?: RequestInit): Response | Promise<Response>;
};

type OpenApiDoc = {
  paths: Record<string, Record<string, { parameters?: Array<{ name: string; in: string }> }>>;
};

const honoRoot = new URL("../../honojs-large-fakerestapi/src/", import.meta.url);
const honoAppModule = await import(new URL("index.ts", honoRoot).href);
const honoOpenApiModule = await import(new URL("openapi.ts", honoRoot).href);
const honoApp = honoAppModule.default as AppLike;
const buildHonoOpenApi = honoOpenApiModule.buildOpenApi as () => OpenApiDoc;

async function requestSnapshot(app: AppLike, path: string, init?: RequestInit) {
  const response = await Promise.resolve(app.request(path, init));
  const text = await response.text();
  return {
    status: response.status,
    headers: Object.fromEntries(
      [...response.headers.entries()].sort((left, right) => left[0].localeCompare(right[0])),
    ),
    body: parseBody(text),
    rawBody: text,
  };
}

function parseBody(text: string): unknown {
  if (!text) return "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function urlForOpenApiPath(path: string): string {
  return path.replace(/\{idBook\}/g, "1").replace(/\{id\}/g, "1");
}

function paramsFor(doc: OpenApiDoc): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [path, methods] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      out[`${method.toUpperCase()} ${path}`] = (operation.parameters ?? []).map(
        (param) => `${param.in}:${param.name}`,
      );
    }
  }
  return out;
}

test("OpenAPI route params and search query params match the Hono fake API", () => {
  const honoDoc = buildHonoOpenApi();
  const daloyDoc = buildDaloyOpenApi() as OpenApiDoc;

  assert.deepEqual(Object.keys(daloyDoc.paths).sort(), Object.keys(honoDoc.paths).sort());
  assert.deepEqual(paramsFor(daloyDoc), paramsFor(honoDoc));
});

test("all documented GET responses match Hono status, body, and client-visible response metadata", async (t) => {
  const honoDoc = buildHonoOpenApi();
  const getPaths = Object.entries(honoDoc.paths)
    .filter(([, methods]) => methods.get)
    .map(([path]) => urlForOpenApiPath(path));

  for (const path of getPaths) {
    await t.test(path, async () => {
      assert.deepEqual(
        await requestSnapshot(daloyApp, path),
        await requestSnapshot(honoApp, path),
      );
    });
  }
});

test("resource query strings return the same filtered counts, bodies, and pagination headers as Hono", async (t) => {
  const queryCases = [
    "?page=2&limit=3",
    "?offset=2&limit=2&fields=id,name",
    "?q=1&sort=-id&limit=5",
    "?search=example&limit=4",
    "?fields=id&sort=id",
  ];

  for (const resource of RESOURCES) {
    for (const query of queryCases) {
      const path = `/api/v1/${resource.name}${query}`;
      await t.test(path, async () => {
        assert.deepEqual(
          await requestSnapshot(daloyApp, path),
          await requestSnapshot(honoApp, path),
        );
      });
    }
  }
});

test("resource mutations match Hono status codes, bodies, and empty-delete shape", async (t) => {
  for (const resource of RESOURCES) {
    const base = `/api/v1/${resource.name}`;
    const cases: Array<[string, string, RequestInit]> = [
      [
        "POST",
        base,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customField: `created-${resource.name}` }),
        },
      ],
      [
        "PUT",
        `${base}/4`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replaced: true }),
        },
      ],
      [
        "PATCH",
        `${base}/5`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patched: true }),
        },
      ],
      ["DELETE", `${base}/6`, { method: "DELETE" }],
    ];

    for (const [method, path, init] of cases) {
      await t.test(`${method} ${path}`, async () => {
        assert.deepEqual(
          await requestSnapshot(daloyApp, path, init),
          await requestSnapshot(honoApp, path, init),
        );
      });
    }
  }
});

test("known and unknown 404 responses are wire-compatible with Hono", async () => {
  assert.deepEqual(
    await requestSnapshot(daloyApp, "/api/v1/Books/9999"),
    await requestSnapshot(honoApp, "/api/v1/Books/9999"),
  );

  assert.deepEqual(
    await requestSnapshot(daloyApp, "/api/v1/NoSuchThing"),
    await requestSnapshot(honoApp, "/api/v1/NoSuchThing"),
  );
});

test("CORS preflight remains compatible with Hono", async () => {
  const init = {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "Content-Type",
    },
  };

  assert.deepEqual(
    await requestSnapshot(daloyApp, "/api/v1/Promotions", init),
    await requestSnapshot(honoApp, "/api/v1/Promotions", init),
  );
});
